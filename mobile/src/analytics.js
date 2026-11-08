import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { fetchJson } from './http.mjs';
let visitorPromise, visit, campaign = {}, campaignAt = 0, firstOpenInFlight = false;
export function setCampaign(value) {
  campaign = {}; campaignAt = Date.now();
  for (const key of ['utm_source','utm_medium','utm_campaign','utm_content']) {
    if (typeof value?.[key] === 'string' && /^[a-z0-9 _.-]{1,100}$/i.test(value[key])) campaign[key] = value[key];
  }
}
export async function analyticsContext() {
  visitorPromise ||= (async()=>{
    let visitor = await SecureStore.getItemAsync('perkdrop_analytics_visitor_v2');
    if (!visitor) { visitor=Crypto.randomUUID(); await SecureStore.setItemAsync('perkdrop_analytics_visitor_v2',visitor); }
    return visitor;
  })().catch(error=>{visitorPromise=undefined;throw error;});
  const now = Date.now();
  if (!visit || now-visit.last > 30*60000) { visit={id:Crypto.randomUUID()}; if(now-campaignAt>30*60000)campaign={}; }
  visit.last=now;
  const sessionId=visit.id;
  return {visitorId:await visitorPromise,sessionId,internal:__DEV__||process.env.EXPO_PUBLIC_TRAFFIC_TYPE==='internal'};
}
export async function resetAnalyticsIdentity() {
  await SecureStore.deleteItemAsync('perkdrop_analytics_visitor_v2');
  await SecureStore.deleteItemAsync('perkdrop_analytics_first_open_v1');
  visitorPromise=undefined;visit=undefined;campaign={};
}
export async function track(event_type,metadata={}) {
  let ownsFirst=false;
  try {
    const c=await analyticsContext();
    const first=event_type==='page_view' && !firstOpenInFlight && !await SecureStore.getItemAsync('perkdrop_analytics_first_open_v1');
    ownsFirst=first&&!firstOpenInFlight;
    if(ownsFirst)firstOpenInFlight=true;
    await fetchJson('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-track',{
      method:'POST',headers:{'content-type':'application/json'},
      body:JSON.stringify({event_type,session_id:c.sessionId,source_page:metadata.path||'app',metadata:{...campaign,...metadata,visitor_id:c.visitorId,traffic_type:c.internal?'internal':'public',platform:'native',os:Platform.OS,app_first_open:ownsFirst}}),
    },5000);
    if(ownsFirst)await SecureStore.setItemAsync('perkdrop_analytics_first_open_v1','true');
  } catch { /* Analytics failure never blocks a user action. */ }
  finally {if(ownsFirst)firstOpenInFlight=false;}
}
