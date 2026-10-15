import test from 'node:test';
import assert from 'node:assert/strict';
import { safeWebUrl, parseIncomingLink, campaignFromUrl, notificationLink, decodeCatalogueCache, listingEnded, validPushToken, pushPreferences, canDeliverPush, passTime } from '../src/release-rules.mjs';
import { fetchJson, RequestError } from '../src/http.mjs';
const token = 'a'.repeat(64);
for (const [name, url] of [['https', 'https://perkdrop.au/deals/family-day'], ['custom', 'perkdrop://deals/family-day'], ['www', 'https://www.perkdrop.au/deals/family-day/']]) {
  test(`opens a valid ${name} listing`, () => assert.equal(parseIncomingLink(url).slug, 'family-day'));
}
for (const value of ['javascript:alert(1)', 'file:///deals/family', 'https://perkdrop.au.evil.test/deals/x', 'https://evil.test/deals/x', 'http://perkdrop.au/deals/x', 'https://user@perkdrop.au/deals/x', 'https://perkdrop.au:444/deals/x', 'https://perkdrop.au/deals/%2fadmin', 'https://perkdrop.au/deals/a%5cb', 'https://perkdrop.au/deals/x#secret', 'perkdrop://connect?token='+token, 'perkdrop://connect#wrong', 'https://perkdrop.au/privacy', '\nhttps://perkdrop.au/deals/x']) {
  test(`rejects unsafe or unsupported incoming link ${value.slice(0, 60)}`, () => assert.equal(parseIncomingLink(value), null));
}
test('private device links are parsed without exposing them to campaign data', () => {
  assert.deepEqual(parseIncomingLink('perkdrop://connect#'+token), { kind: 'connect', token });
  assert.deepEqual(campaignFromUrl('perkdrop://connect#'+token), {});
});
test('keeps only bounded campaign fields', () => assert.deepEqual(campaignFromUrl('https://perkdrop.au/deals/x?utm_source=instagram&utm_campaign=family-week1&email=a@b.c&token=secret'), {utm_source:'instagram',utm_campaign:'family-week1'}));
test('rejects credential-bearing web links and empty fallback', () => {
  assert.equal(safeWebUrl(''), null); assert.equal(safeWebUrl('https://u:p@site.test'), null); assert.equal(safeWebUrl('javascript:x'), null); assert.equal(safeWebUrl('/deals/a'), 'https://perkdrop.au/deals/a');
});
const now = Date.parse('2026-09-29T10:00:00Z');
test('notification requires future expiry and a public deal link', () => {
  assert.equal(notificationLink({url:'https://perkdrop.au/deals/x',expiresAt:'2026-09-30T10:00:00Z'},now).slug,'x');
  assert.equal(notificationLink({url:'https://perkdrop.au/deals/x'},now),null);
  assert.equal(notificationLink({url:'https://perkdrop.au/deals/x',expiresAt:'2026-09-28T10:00:00Z'},now),null);
  assert.equal(notificationLink({url:'perkdrop://connect#'+token,expiresAt:'2026-09-30T10:00:00Z'},now),null);
});
test('cache strips capacity claims and removes ended listings', () => {
  const data=decodeCatalogueCache(JSON.stringify({version:1,savedAt:now-1000,items:[{id:'live',title:'x',ends_at:'2026-09-30T10:00:00Z',redemptionAvailable:true,capacityRemaining:10},{id:'old',ends_at:'2026-09-29T09:00:00Z'}]}),now);
  assert.equal(data.items.length,1); assert.equal(data.items[0].redemptionAvailable,false); assert.equal(data.items[0].capacityRemaining,0);
});
for (const [name,text] of [['invalid','x'],['old',JSON.stringify({version:1,savedAt:now-25*3600_000,items:[]})],['future',JSON.stringify({version:1,savedAt:now+120000,items:[]})],['wrong version',JSON.stringify({version:2,savedAt:now,items:[]})]]) {
  test(`rejects ${name} cache`,()=>assert.equal(decodeCatalogueCache(text,now),null));
}
test('date-only expiry uses venue timezone at midnight',()=>{
  assert.equal(listingEnded({end:'2026-09-29',timezone:'Australia/Adelaide'},Date.parse('2026-09-29T15:00:00Z')),true);
  assert.equal(listingEnded({end:'2026-09-29',timezone:'Australia/Perth'},Date.parse('2026-09-29T15:00:00Z')),false);
});
test('withdrawn listings are not kept in cache',()=>assert.equal(listingEnded({lifecycle_status:'withdrawn'}),true));
test('push tokens are validated',()=>{assert.equal(validPushToken('ExponentPushToken[abcdefghijklmn_123]'),true);assert.equal(validPushToken('other'),false);});
test('notification preferences enforce city/timezone and weekly cap',()=>{assert.throws(()=>pushPreferences({city:'fake'}));assert.throws(()=>pushPreferences({city:'adelaide',timezone:'fake'}));assert.equal(pushPreferences({city:'Adelaide'}).frequency,'weekly');});
test('quiet hours and seven-day frequency are enforced',()=>{
  const p=pushPreferences({city:'adelaide'});
  const day=Date.parse('2026-09-29T00:30:00Z');
  assert.equal(canDeliverPush(p,day),true);
  assert.equal(canDeliverPush(p,Date.parse('2026-09-29T12:00:00Z')),false);
  assert.equal(canDeliverPush(p,day,'2026-09-28T00:30:00Z'),false);
  assert.equal(canDeliverPush(p,day,'2026-09-20T00:30:00Z'),true);
});
test('pass times are formatted rather than shown as raw timestamps',()=>assert.ok(passTime('2026-09-30T00:30:00Z','Australia/Adelaide').includes('10:00')));
test('fetch returns valid JSON',async()=>assert.deepEqual(await fetchJson('https://example.test',{},100,async()=>({ok:true,status:200,json:async()=>({ok:true})})),{ok:true}));
test('fetch preserves server status for denied requests',async()=>assert.rejects(fetchJson('https://example.test',{},100,async()=>({ok:false,status:401,json:async()=>({error:'identity_required'})})),e=>e instanceof RequestError&&e.status===401));
test('fetch times out even if transport never settles',async()=>assert.rejects(fetchJson('https://example.test',{},5,()=>new Promise(()=>{})),/timed out/));
test('fetch times out during body parsing too',async()=>assert.rejects(fetchJson('https://example.test',{},5,async()=>({ok:true,status:200,json:()=>new Promise(()=>{})})),/timed out/));
test('fetch rejects malformed responses',async()=>assert.rejects(fetchJson('https://example.test',{},100,async()=>({ok:true,status:200,json:async()=>{throw Error();}})),/unreadable/));
