import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { fetchJson } from './http.mjs';
import { createPrivateAccessGuard } from './private-access.mjs';
const KEY = 'perkdrop_consumer_credential_v1';
const BASE = 'https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/';
const access = createPrivateAccessGuard();
let credentialPromise;
const newCredential = () => Array.from(Crypto.getRandomBytes(32), byte => byte.toString(16).padStart(2, '0')).join('');
async function credential() {
  const existing = await SecureStore.getItemAsync(KEY);
  if (/^[a-f0-9]{64}$/.test(existing || '')) return existing;
  const value = newCredential();
  await SecureStore.setItemAsync(KEY, value);
  return value;
}
async function identity() {
  credentialPromise ||= credential().catch(error => { credentialPromise = undefined; throw error; });
  return credentialPromise;
}
const request = (service, action, body, token) => fetchJson(BASE + service, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(token ? { 'x-perkdrop-identity': token } : {}) },
  body: JSON.stringify({ ...body, action }),
});
const privateRequest = (service, action, body) => access.run(async check => {
  const token = await identity();
  check(); // Identity creation can yield while a pairing/deletion starts.
  return request(service, action, body, token);
});
export async function marketplace(action, body = {}) {
  return privateRequest('perkdrop-marketplace', action, body);
}
export async function mobileService(action, body = {}) {
  if (action === 'capabilities') return request('perkdrop-mobile-device', action, body);
  return privateRequest('perkdrop-mobile-device', action, body);
}
export async function connectDevice(token) {
  if (!/^[a-f0-9]{64}$/.test(token || '')) throw Error('Invalid device link.');
  const finish = access.beginChange();
  try {
    // Settle any previous SecureStore initialisation before replacing the key.
    const previous = await identity();
    if (await SecureStore.getItemAsync('perkdrop_push_optin_v1') === 'true') {
      await request('perkdrop-mobile-device', 'push_disable', {}, previous);
      await SecureStore.deleteItemAsync('perkdrop_push_optin_v1');
    }
    const value = newCredential();
    await request('perkdrop-marketplace', 'device_connect', { token, new_credential: value, label: 'PerkDrop app' });
    await SecureStore.setItemAsync(KEY, value);
    credentialPromise = Promise.resolve(value);
  } finally { finish(); }
}
export async function deleteAccount() {
  const finish = access.beginChange();
  try {
    const token = await identity();
    const result = await request('perkdrop-mobile-device', 'delete_account', { confirmation: 'DELETE' }, token);
    if (result.deleted !== true) throw Error('Deletion was not confirmed. Your app access has not been cleared.');
    // Do not admit another request while the deleted credential is being removed.
    // Server-confirmed deletion is not reported as failed because local cleanup failed.
    await Promise.all([KEY, 'perkdrop_push_optin_v1', 'perkdrop_push_disable_pending_v1'].map(key => SecureStore.deleteItemAsync(key).catch(() => {})));
    credentialPromise = undefined;
    return result;
  } finally { finish(); }
}
