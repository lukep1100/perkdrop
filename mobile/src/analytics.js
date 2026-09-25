import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
let visitor,visit;
export async function analyticsContext(){
 if(!visitor){visitor=await SecureStore.getItemAsync('perkdrop_analytics_visitor_v2');if(!visitor){visitor=Crypto.randomUUID();await SecureStore.setItemAsync('perkdrop_analytics_visitor_v2',visitor);}}
 const now=Date.now();if(!visit||now-visit.last>30*60000)visit={id:Crypto.randomUUID()};visit.last=now;
 return {visitorId:visitor,sessionId:visit.id,internal:__DEV__||process.env.EXPO_PUBLIC_TRAFFIC_TYPE==='internal'};
}
export async function track(event_type,metadata={}){try{const c=await analyticsContext();await fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event_type,session_id:c.sessionId,source_page:metadata.path||'app',metadata:{...metadata,visitor_id:c.visitorId,traffic_type:c.internal?'internal':'public',platform:'native'}})});}catch{}}
