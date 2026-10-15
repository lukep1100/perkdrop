import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { mobileService } from './marketplace';
import { notificationLink, pushPreferences, validPushToken } from './release-rules.mjs';
import config from '../app.json';
const OPT_IN = 'perkdrop_push_optin_v1';
const PENDING_DISABLE = 'perkdrop_push_disable_pending_v1';
export const PUSH_BUILD_ENABLED = process.env.EXPO_PUBLIC_PUSH_ENABLED === 'true';
Notifications.setNotificationHandler({handleNotification:async notification=>{const allowed=PUSH_BUILD_ENABLED && !!notificationLink(notification.request.content.data) && await SecureStore.getItemAsync(OPT_IN)==='true' && await SecureStore.getItemAsync(PENDING_DISABLE)!=='true';return {shouldShowBanner:allowed,shouldShowList:allowed,shouldPlaySound:false,shouldSetBadge:false};}});
const permissionGranted = p => p.granted || p.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
export async function notificationStatus() {
  if (!PUSH_BUILD_ENABLED) return { enabled:false, available:false };
  const capabilities = await mobileService('capabilities');
  if (!capabilities.push_enabled) return { enabled:false, available:false };
  const status = await mobileService('push_status');
  return { enabled:!!status.enabled, available:true, preferences:status.preferences };
}
export async function enableNotifications(input) {
  if (!PUSH_BUILD_ENABLED) throw Error('Push delivery is not enabled in this release candidate.');
  const capabilities = await mobileService('capabilities');
  if (!capabilities.push_enabled) throw Error('Notification delivery is not configured yet.');
  const preferences = pushPreferences(input);
  if (Platform.OS === 'android') await Notifications.setNotificationChannelAsync('perks',{name:'Weekly local picks',importance:Notifications.AndroidImportance.DEFAULT,sound:null});
  let permission = await Notifications.getPermissionsAsync();
  if (!permissionGranted(permission)) permission = await Notifications.requestPermissionsAsync();
  if (!permissionGranted(permission)) throw Error('Notifications are off. You can enable them in your phone settings.');
  const token=(await Notifications.getExpoPushTokenAsync({projectId:config.expo.extra.eas.projectId})).data;
  if (!validPushToken(token)) throw Error('This device could not register for notifications.');
  await mobileService('push_register',{token,platform:Platform.OS,preferences});
  await SecureStore.setItemAsync(OPT_IN,'true');
  await SecureStore.deleteItemAsync(PENDING_DISABLE);
  return { enabled:true, available:true, preferences };
}
export async function disableNotifications() {
  await SecureStore.setItemAsync(PENDING_DISABLE,'true');
  await mobileService('push_disable');
  await SecureStore.deleteItemAsync(OPT_IN);
  await SecureStore.deleteItemAsync(PENDING_DISABLE);
  return { enabled:false, available:PUSH_BUILD_ENABLED };
}
export async function reconcileNotificationPermission() {
  if (await SecureStore.getItemAsync(PENDING_DISABLE) === 'true') return disableNotifications();
  if (!PUSH_BUILD_ENABLED || await SecureStore.getItemAsync(OPT_IN) !== 'true') return;
  const permissions=await Notifications.getPermissionsAsync();
  if (!permissionGranted(permissions)) return disableNotifications();
}
export function observeNotificationOpens(onLink,onExpired) {
  let disposed=false;
  const consume=async response=>{
    if (!response || response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
    const id=response.notification.request.identifier;
    if (!id || id===await SecureStore.getItemAsync('perkdrop_last_notification_v1')) return;
    const link=notificationLink(response.notification.request.content.data);
    await SecureStore.setItemAsync('perkdrop_last_notification_v1',id);
    await Notifications.clearLastNotificationResponseAsync();
    if(disposed)return;
    if(link)onLink('https://perkdrop.au'+link.path);else onExpired();
  };
  const listener=Notifications.addNotificationResponseReceivedListener(r=>consume(r).catch(()=>{}));
  Notifications.getLastNotificationResponseAsync().then(consume).catch(()=>{});
  return ()=>{disposed=true;listener.remove();};
}
