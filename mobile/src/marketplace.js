import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { fetchJson } from './http.mjs';
const KEY = 'perkdrop_consumer_credential_v1';
const BASE = 'https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/';
let credentialPromise;
async function credential() {
  const existing = await SecureStore.getItemAsync(KEY);
  if (/^[a-f0-9]{64}$/.test(existing || '')) return existing;
  const value = Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY, value);
  return value;
}
async function identity() {
  credentialPromise ||= credential().catch(error => { credentialPromise = undefined; throw error; });
  return credentialPromise;
}
export async function marketplace(action, body = {}) {
  return fetchJson(BASE + 'perkdrop-marketplace', {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-perkdrop-identity': await identity() },
    body: JSON.stringify({ action, ...body }),
  });
}
export async function mobileService(action, body = {}) {
  const headers = { 'content-type': 'application/json' };
  if (action !== 'capabilities') headers['x-perkdrop-identity'] = await identity();
  return fetchJson(BASE + 'perkdrop-mobile-device', { method: 'POST', headers, body: JSON.stringify({ action, ...body }) });
}
export async function connectDevice(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw Error('Invalid device link.');
  if (await SecureStore.getItemAsync('perkdrop_push_optin_v1') === 'true') {
    await mobileService('push_disable');
    await SecureStore.deleteItemAsync('perkdrop_push_optin_v1');
  }
  const value = Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
  await fetchJson(BASE + 'perkdrop-marketplace', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'device_connect', token, new_credential: value, label: 'PerkDrop app' }) });
  await SecureStore.setItemAsync(KEY, value);
  credentialPromise = Promise.resolve(value);
}
export async function deleteAccount() {
  const result = await mobileService('delete_account', { confirmation: 'DELETE' });
  if (result.deleted !== true) throw Error('Deletion was not confirmed. Your app access has not been cleared.');
  // A confirmed server deletion must not be described as failed due to local cleanup.
  credentialPromise = undefined;
  await Promise.all([KEY,'perkdrop_push_optin_v1','perkdrop_push_disable_pending_v1'].map(key=>SecureStore.deleteItemAsync(key).catch(()=>{})));
  return result;
}
