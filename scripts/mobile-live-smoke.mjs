import assert from 'node:assert/strict';
const base='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/';
// Public capabilities and rejected requests only: no account, save, claim,
// subscriber, deletion, analytics event or notification is created by this script.
const request=(path,options={})=>fetch(base+path,{...options,signal:AbortSignal.timeout(12000)});
let count=0;
async function check(name,run){await run();count++;console.log('LIVE CONTRACT PASS: '+name);}
await check('deployed capabilities advertise deletion and keep push disabled',async()=>{
 const r=await request('perkdrop-mobile-device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'capabilities'})});
 assert.equal(r.status,200);const data=await r.json();assert.equal(data.account_deletion,true);assert.equal(data.push_enabled,false);assert.equal(data.policy_version,'2026-09-29');
});
await check('device service rejects unsupported GET',async()=>assert.equal((await request('perkdrop-mobile-device')).status,405));
await check('deletion without a device credential is rejected before account access',async()=>{
 const r=await request('perkdrop-mobile-device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'delete_account',confirmation:'DELETE'})});
 assert.equal(r.status,401);assert.equal((await r.json()).error,'identity_required');
});
await check('malformed JSON is rejected',async()=>assert.equal((await request('perkdrop-mobile-device',{method:'POST',headers:{'content-type':'application/json'},body:'{'})).status,400));
await check('oversized request is rejected',async()=>assert.equal((await request('perkdrop-mobile-device',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({padding:'x'.repeat(17000)})})).status,400));
await check('public CORS preflight does not require an identity',async()=>assert.equal((await request('perkdrop-mobile-device',{method:'OPTIONS'})).status,204));
await check('private push worker rejects an unauthenticated request',async()=>{
 const r=await request('perkdrop-mobile-push',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'dispatch'})});assert.ok([401,403].includes(r.status));
});
await check('tracking rejects an unknown event without adding traffic',async()=>{
 const r=await request('perkdrop-track',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({event_type:'not_a_valid_event'})});assert.equal(r.status,400);assert.equal((await r.json()).error,'invalid_event');
});
console.log(`LIVE CONTRACT: ${count} checks passed. No valid credentials or customer mutations used.`);
