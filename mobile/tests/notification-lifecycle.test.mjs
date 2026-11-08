import test from 'node:test';
import assert from 'node:assert/strict';
import {createPushReconciler, createNotificationResponseConsumer, readPushToken} from '../src/notification-lifecycle.mjs';
import {createPrivateAccessGuard} from '../src/private-access.mjs';
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
const fixture=()=>{
  const state={consent:true,pendingDisable:false,permission:true,serverEnabled:true,capability:true,cleared:0,disabled:0,calls:[],tokens:0};
  const guard=createPrivateAccessGuard();
  const options={
    buildEnabled:true,readConsent:async()=>state.consent,readPendingDisable:async()=>state.pendingDisable,
    clearConsent:async()=>{state.consent=false;state.cleared++;},getPermissions:async()=>state.permission,hasPermission:value=>value,
    service:async(action,body)=>{state.calls.push([action,body]);if(action==='capabilities')return {push_enabled:state.capability};if(action==='push_status')return {enabled:state.serverEnabled};return {enabled:true,refreshed:true};},
    getToken:async()=>{state.tokens++;return 'ExpoPushToken[local-test-token]';},validToken:token=>token==='ExpoPushToken[local-test-token]',
    disable:async()=>{state.disabled++;state.consent=false;},runPrivate:operation=>guard.run(operation),
  };
  return {state,options,guard};
};
test('a transient read-only token failure is retried without exposing provider errors',async()=>{
  let calls=0;assert.equal(await readPushToken(async()=>{if(++calls===1)throw Error('provider private detail');return 'token';},{wait:async()=>{}}),'token');assert.equal(calls,2);
});
test('a hanging token provider is bounded and never silently succeeds',async()=>{
  await assert.rejects(readPushToken(()=>new Promise(()=>{}),{timeoutMs:5,wait:async()=>{}}),/could not register/);
});
test('disabled builds and unconsented devices never request tokens or contact the service',async()=>{
  for(const build of [true,false]){const {state,options}=fixture();state.consent=false;options.buildEnabled=build;await createPushReconciler(options)();assert.equal(state.tokens,0);assert.equal(state.calls.length,0);}
});
test('a pending opt-out is retried even by a push-disabled build',async()=>{
  const {state,options}=fixture();state.pendingDisable=true;options.buildEnabled=false;await createPushReconciler(options)();assert.equal(state.disabled,1);assert.equal(state.tokens,0);
});
test('backend-disabled delivery never requests a device token',async()=>{
  const {state,options}=fixture();state.capability=false;await createPushReconciler(options)();assert.equal(state.tokens,0);assert.deepEqual(state.calls.map(c=>c[0]),['capabilities']);
});
test('revoking phone permission disables the existing subscription',async()=>{
  const {state,options}=fixture();state.permission=false;await createPushReconciler(options)();assert.equal(state.disabled,1);assert.equal(state.tokens,0);
});
test('server-side opt-out clears local consent without registering again',async()=>{
  const {state,options}=fixture();state.serverEnabled=false;await createPushReconciler(options)();assert.equal(state.cleared,1);assert.equal(state.tokens,0);assert.ok(!state.calls.some(c=>c[0]==='push_register'));
});
test('foreground refresh uses the non-opt-in endpoint without changing preferences',async()=>{
  const {state,options}=fixture();await createPushReconciler(options)();assert.deepEqual(state.calls.map(c=>c[0]),['capabilities','push_status','push_refresh']);assert.deepEqual(state.calls.at(-1)[1],{token:'ExpoPushToken[local-test-token]'});
});
test('opt-out begun while a token is loading prevents its refresh request',async()=>{
  const {state,options}=fixture();const token=deferred();options.getToken=()=>token.promise;const reconcile=createPushReconciler(options);const result=reconcile();await new Promise(resolve=>setImmediate(resolve));state.pendingDisable=true;token.resolve('ExpoPushToken[local-test-token]');await result;assert.ok(!state.calls.some(c=>c[0]==='push_refresh'));
});
test('pairing or deletion during token acquisition prevents a request under the new identity',async()=>{
  const {state,options,guard}=fixture();const token=deferred();options.getToken=()=>token.promise;const result=createPushReconciler(options)();const rejected=assert.rejects(result,/private access changed/);await new Promise(resolve=>setImmediate(resolve));const finish=guard.beginChange();token.resolve('ExpoPushToken[local-test-token]');await rejected;await guard.waitForPending();finish();assert.ok(!state.calls.some(c=>c[0]==='push_refresh'));
});
test('an opt-out winning the refresh race is never re-enabled',async()=>{
  const {state,options}=fixture();const original=options.service;options.service=async(action,body)=>action==='push_refresh'?{enabled:false,refreshed:false}:original(action,body);await createPushReconciler(options)();assert.equal(state.cleared,1);assert.ok(!state.calls.some(c=>c[0]==='push_register'));
});
test('simultaneous foreground checks share one refresh',async()=>{
  const {state,options}=fixture();const token=deferred();options.getToken=()=>token.promise;const reconcile=createPushReconciler(options);const a=reconcile(),b=reconcile();assert.equal(a,b);token.resolve('ExpoPushToken[local-test-token]');await Promise.all([a,b]);assert.equal(state.calls.filter(c=>c[0]==='push_refresh').length,1);
});
test('a native token roll during a refresh is queued and passed directly to the token provider',async()=>{
  const {options}=fixture();const first=deferred(),secondDone=deferred();const inputs=[];options.getToken=async native=>{inputs.push(native);if(inputs.length===1)return first.promise;secondDone.resolve();return 'ExpoPushToken[local-test-token]';};const reconcile=createPushReconciler(options);const result=reconcile();await new Promise(resolve=>setImmediate(resolve));const native={type:'ios',data:'native-test-token'};reconcile(native);first.resolve('ExpoPushToken[local-test-token]');await result;await secondDone.promise;assert.equal(inputs[1],native);
});

const response=(id='one',data={path:'/deals/current'})=>({actionIdentifier:'default',notification:{request:{identifier:id,content:{data}}}});
const consumerFixture=()=>{
  const state={last:null,links:[],expired:0,cleared:0};
  const options={defaultAction:'default',readLast:async()=>state.last,remember:async id=>{state.last=id;},clear:async()=>{state.cleared++;},parseLink:data=>data?.path?data:null,onLink:link=>state.links.push(link),onExpired:()=>state.expired++};
  return {state,options};
};
test('cold-start and live callbacks for the same notification navigate once',async()=>{
  const {state,options}=consumerFixture();const c=createNotificationResponseConsumer(options);await Promise.all([c.consume(response()),c.consume(response())]);assert.equal(state.links.length,1);assert.equal(state.cleared,1);
});
test('expired notifications show one expiry result and never open a stale link',async()=>{
  const {state,options}=consumerFixture();const c=createNotificationResponseConsumer(options);await Promise.all([c.consume(response('old',{})),c.consume(response('old',{}))]);assert.equal(state.links.length,0);assert.equal(state.expired,1);
});
test('cleanup during storage lookup does not consume an unopened notification',async()=>{
  const {state,options}=consumerFixture();const stored=deferred();options.readLast=()=>stored.promise;const c=createNotificationResponseConsumer(options);const result=c.consume(response());await new Promise(resolve=>setImmediate(resolve));c.stop();stored.resolve(null);await result;assert.equal(state.links.length,0);assert.equal(state.last,null);assert.equal(state.cleared,0);
});
test('one storage failure does not block later notifications or repeat a completed navigation',async()=>{
  const {state,options}=consumerFixture();options.remember=async()=>{throw Error('storage unavailable');};const c=createNotificationResponseConsumer(options);await assert.rejects(c.consume(response('first')),/storage unavailable/);await c.consume(response('first'));await assert.rejects(c.consume(response('second')),/storage unavailable/);assert.equal(state.links.length,2);assert.equal(state.cleared,2);
});
