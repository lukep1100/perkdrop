import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { mobileService, withPrivateAccess } from './marketplace';
import { createPushReconciler, createNotificationResponseConsumer, readPushToken } from './notification-lifecycle.mjs';
import { notificationLink, pushPreferences, validPushToken } from './release-rules.mjs';
import config from '../app.json';
const OPT_IN = 'perkdrop_push_optin_v1';
const PENDING_DISABLE = 'perkdrop_push_disable_pending_v1';
export const PUSH_BUILD_ENABLED = process.env.EXPO_PUBLIC_PUSH_ENABLED === 'true';
Notifications.setNotificationHandler({handleNotification:async notification=>{const allowed=PUSH_BUILD_ENABLED && !!notificationLink(notification.request.content.data) && await SecureStore.getItemAsync(OPT_IN)==='true' && await SecureStore.getItemAsync(PENDING_DISABLE)!=='true';return {shouldShowBanner:allowed,shouldShowList:allowed,shouldPlaySound:false,shouldSetBadge:false};}});
const permissionGranted = p => p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
const currentExpoToken = async nativeToken => (await Notifications.getExpoPushTokenAsync({projectId:config.expo.extra.eas.projectId,...(nativeToken?{devicePushToken:nativeToken}:{})})).data;
export async function notificationStatus() {
  return withPrivateAccess(async check => {
  if (!PUSH_BUILD_ENABLED) return { enabled:false, available:false };
  const capabilities = await mobileService('capabilities');
  check();
  if (!capabilities.push_enabled) return { enabled:false, available:false };
  const status = await mobileService('push_status');
  check();
  if (await SecureStore.getItemAsync(PENDING_DISABLE) === 'true') return {enabled:false,available:true,preferences:status.preferences};
  if (status.enabled) {
    const permission = await Notifications.getPermissionsAsync();
    check();
    if (!permissionGranted(permission)) return disableNotifications();
    await SecureStore.setItemAsync(OPT_IN,'true');
  } else await SecureStore.deleteItemAsync(OPT_IN);
  return { enabled:!!status.enabled, available:true, preferences:status.preferences };
  });
}
export async function enableNotifications(input) {
  return withPrivateAccess(async check => {
  if (!PUSH_BUILD_ENABLED) throw Error('Push delivery is not enabled in this release candidate.');
  const capabilities = await mobileService('capabilities');
  check();
  if (!capabilities.push_enabled) throw Error('Notification delivery is not configured yet.');
  const preferences = pushPreferences(input);
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('perks',{name:'Weekly local picks',importance:Notifications.AndroidImportance.DEFAULT,sound:null});
  let permission = await Notifications.getPermissionsAsync();
  if (!permissionGranted(permission)) permission = await Notifications.requestPermissionsAsync();
  check();
  if (!permissionGranted(permission)) throw Error('Notifications are off. You can enable them in your phone settings.');
  const token=await readPushToken(()=>currentExpoToken());
  check();
  if (!validPushToken(token)) throw Error('This device could not register for notifications.');
  await mobileService('push_register',{token,platform:Platform.OS,preferences});
  check();
  await SecureStore.setItemAsync(OPT_IN,'true');
  await SecureStore.deleteItemAsync(PENDING_DISABLE);
  return { enabled:true, available:true, preferences };
  });
}
export async function disableNotifications() {
  return withPrivateAccess(async check => {
  await SecureStore.setItemAsync(PENDING_DISABLE,'true');
  check();
  await mobileService('push_disable');
  check();
  await SecureStore.deleteItemAsync(OPT_IN);
  await SecureStore.deleteItemAsync(PENDING_DISABLE);
  return { enabled:false, available:PUSH_BUILD_ENABLED };
  });
}
export const reconcileNotificationPermission = createPushReconciler({
  buildEnabled:PUSH_BUILD_ENABLED,
  readConsent:async()=>await SecureStore.getItemAsync(OPT_IN)==='true',
  readPendingDisable:async()=>await SecureStore.getItemAsync(PENDING_DISABLE)==='true',
  clearConsent:()=>SecureStore.deleteItemAsync(OPT_IN),
  getPermissions:()=>Notifications.getPermissionsAsync(),hasPermission:permissionGranted,
  service:(action,body)=>mobileService(action,{...body,...(action==='push_refresh'?{platform:Platform.OS}:{})}),
  getToken:currentExpoToken,validToken:validPushToken,disable:disableNotifications,runPrivate:withPrivateAccess,
});
export function observePushTokenChanges() {
  if (!PUSH_BUILD_ENABLED) return ()=>{};
  const listener=Notifications.addPushTokenListener(nativeToken=>reconcileNotificationPermission(nativeToken).catch(()=>{}));
  return ()=>listener.remove();
}
export function observeNotificationOpens(onLink,onExpired) {
  const consumer=createNotificationResponseConsumer({
    defaultAction:Notifications.DEFAULT_ACTION_IDENTIFIER,
    readLast:()=>SecureStore.getItemAsync('perkdrop_last_notification_v1'),
    remember:id=>SecureStore.setItemAsync('perkdrop_last_notification_v1',id),
    clear:()=>Notifications.clearLastNotificationResponseAsync(),parseLink:notificationLink,
    onLink:link=>onLink('https://perkdrop.au'+link.path),onExpired,
  });
  const listener=Notifications.addNotificationResponseReceivedListener(r=>consumer.consume(r).catch(()=>{}));
  Notifications.getLastNotificationResponseAsync().then(consumer.consume).catch(()=>{});
  return ()=>{consumer.stop();listener.remove();};
}
