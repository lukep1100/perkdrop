import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

const KEY = 'perkdrop_consumer_credential_v1';
const API = 'https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-marketplace';
let credentialPromise;
async function credential() {
  const existing = await SecureStore.getItemAsync(KEY);
  if (/^[a-f0-9]{64}$/.test(existing || '')) return existing;
  const value = Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY, value);
  return value;
}
export async function marketplace(action, body = {}) {
  credentialPromise ||= credential().catch(error => { credentialPromise = undefined; throw error; });
  const token = await credentialPromise;
  const response = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-perkdrop-identity': token },
    body: JSON.stringify({ action, ...body }),
  });
  const result = await response.json();
  if (!response.ok) throw new Error(String(result.error || 'Request failed').replaceAll('_', ' '));
  return result;
}

export async function connectDevice(token){
 const value=Array.from(Crypto.getRandomBytes(32),byte=>byte.toString(16).padStart(2,'0')).join('');
 const response=await fetch(API,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'device_connect',token,new_credential:value,label:'PerkDrop app'})});
 if(!response.ok)throw Error('Device link unavailable');
 await SecureStore.setItemAsync(KEY,value);credentialPromise=Promise.resolve(value);
}
