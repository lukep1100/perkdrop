import test from 'node:test';
import assert from 'node:assert/strict';
import {sendRequest,retryState,dispatchMerchantBatch} from '../supabase/functions/perkdrop-notification-dispatch/worker.ts';
import {navigationDestination,validDropId} from '../supabase/functions/perkdrop-nav/rules.ts';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
const body={from:'Test <sender@example.invalid>',to:['qa@example.invalid'],subject:'Isolated transport test',text:'No merchant approval',html:'<p>No merchant approval</p>'};
test('verification/recovery keeps selected business even before directory load completes',async()=>{
  const source=await readFile(new URL('../supabase/functions/perkdrop-portal/index.ts',import.meta.url),'utf8');
  const line=source.split('\n').find(x=>x.startsWith('function claimRedirect'));
  const context={URL,selected:null,location:{href:'https://perkdrop.au/claim?merchant=union-hotel-adelaide'}};
  assert.equal(vm.runInNewContext(line+';claimRedirect()',context),'https://perkdrop.au/claim?merchant=union-hotel-adelaide');
  assert.equal(vm.runInNewContext(line+';claimRedirect(true)',context),'https://perkdrop.au/claim?merchant=union-hotel-adelaide&recovery=1');
});
test('provider acceptance retains an ID and stable idempotency key, not delivery',async()=>{
  const requests=[],transport=async(url,init)=>{requests.push({url,...init});return Response.json({id:'fixture-provider-id'});};
  for(let i=0;i<2;i++)assert.deepEqual(await sendRequest('fixture-only','fixture-id',body,transport),{accepted:true,providerId:'fixture-provider-id'});
  assert.equal(requests[0].headers['idempotency-key'],requests[1].headers['idempotency-key']);
  assert.equal(requests[0].body,requests[1].body);
});
test('bounded backoff stays inside idempotency window',()=>{
  const now=Date.now();assert.equal(retryState(1,new Date(now).toISOString(),now).next_attempt_at,new Date(now+60000).toISOString());
  assert.equal(retryState(5,new Date(now).toISOString(),now).status,'delivery_unknown');
  assert.equal(retryState(2,new Date(now-24*3600000).toISOString(),now).status,'delivery_unknown');
});
test('network ambiguity, 429 and 5xx retry; invalid requests fail without response leakage',async()=>{
  assert.equal((await sendRequest('fixture','id',body,async()=>{throw Error('DO NOT LEAK');})).retryable,true);
  for(const status of [429,500,503])assert.equal((await sendRequest('fixture','id',body,async()=>Response.json({secret:'DO NOT LEAK'},{status}))).retryable,true);
  const failure=await sendRequest('fixture','id',body,async()=>Response.json({secret:'DO NOT LEAK'},{status:422}));
  assert.equal(failure.retryable,false);assert.ok(!JSON.stringify(failure).includes('DO NOT LEAK'));
  assert.equal((await sendRequest('fixture','id',body,async()=>Response.json({}))).uncertain,true);
});
function fakeDatabase({allowed=true,failAcceptance=false}={}){
  const row={id:'fixture-id',merchant_id:'fixture-merchant',status:'processing',attempt_count:1,first_attempt_at:new Date().toISOString(),processing_started_at:new Date().toISOString(),recipient_email:'qa@example.invalid',provider_request:body};
  const writes=[],calls=[];
  return {row,writes,calls,db:{
    rpc:async(name)=>{calls.push(name);return {data:name==='claim_merchant_notifications'?[row]:allowed};},
    from:()=>({update:patch=>{const filters={};const q={eq:(key,value)=>{filters[key]=value;return q;},select:async()=>{writes.push({patch,filters});return failAcceptance&&patch.status==='provider_accepted'?{error:{message:'fixture'}}:{data:[{id:row.id}]};}};return q;}}),
  }};
}
test('worker persists API acceptance and never claims the consumer queue',async()=>{
  const f=fakeDatabase();let sent=0;
  const result=await dispatchMerchantBatch(f.db,'fixture',20,()=>{throw Error('must reuse frozen payload');},async()=>{sent++;return Response.json({id:'provider-id'});});
  assert.equal(sent,1);assert.equal(result.provider_accepted,1);assert.equal(result.sent,undefined);
  assert.equal(f.writes[0].patch.status,'provider_accepted');assert.equal(f.writes[0].filters.attempt_count,1);
  assert.ok(!f.calls.includes('claim_marketplace_email_notifications'));
});
test('last-minute policy block sends nothing; database receipt failure never reports success',async()=>{
  const blocked=fakeDatabase({allowed:false});let sent=0;
  const transport=async()=>{sent++;return Response.json({id:'id'});};
  assert.equal((await dispatchMerchantBatch(blocked.db,'fixture',20,()=>body,transport)).skipped,1);assert.equal(sent,0);
  await assert.rejects(dispatchMerchantBatch(fakeDatabase({failAcceptance:true}).db,'fixture',20,()=>body,transport),/persistence/);
});
test('named Union special IDs navigate and absent coordinates never become zero',()=>{
  assert.ok(validDropId('union-parmi-pint'));assert.ok(validDropId('PD-2026-0062'));assert.ok(!validDropId('../private'));
  assert.equal(navigationDestination({latitude:null,longitude:null,location:'174 Grand Junction Road'}),'174 Grand Junction Road');
  assert.equal(navigationDestination({latitude:-34.8516159,longitude:138.5297088}),'-34.8516159,138.5297088');
});
