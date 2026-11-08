import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import vm from 'node:vm';
import {isAutomatedAgent,isBotAnalyticsEvent,isPublicAnalyticsEvent} from '../supabase/functions/_shared/analytics-traffic.mjs';
import {directoryVisible} from '../supabase/functions/_shared/discovery.ts';
import {navigationDestination,validDropId} from '../supabase/functions/perkdrop-nav/rules.ts';

const human='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const robot='Mozilla/5.0 (Linux; Android 6.0.1; Nexus 5X) Chrome/153.0 Mobile Safari/537.36 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';

test('known automation is excluded while normal browser and native agents remain eligible',()=>{
  for(const agent of [robot,'GoogleOther','facebookexternalhit/1.1','meta-externalagent/1.1','curl/8.0','python-urllib/3.12','HeadlessChrome/130'])assert.equal(isAutomatedAgent(agent),true,agent);
  for(const agent of [human,'PerkDrop/1.0 CFNetwork/3860 Darwin/24.0','Mozilla/5.0 Chrome/130 Safari/537.36','',null])assert.equal(isAutomatedAgent(agent),false,agent);
  assert.equal(isPublicAnalyticsEvent({user_agent:robot,metadata:{traffic_type:'public'}}),false);
  assert.equal(isPublicAnalyticsEvent({user_agent:human,metadata:{traffic_type:'internal'}}),false);
  assert.equal(isPublicAnalyticsEvent({metadata:{traffic_type:'bot'}}),false);
  assert.equal(isPublicAnalyticsEvent({metadata:{is_bot:true}}),false);
  assert.equal(isPublicAnalyticsEvent({user_agent:human,metadata:{traffic_type:'public'}}),true);
  assert.equal(isPublicAnalyticsEvent({user_agent:human}),true);
});

async function handlerFor(name,{deal,activeOffer}={}){
  const writes=[];let handler;
  const client={from(table){const q={select(){return q},eq(){return q},neq(){return q},gte(){return q},limit(){return q},async maybeSingle(){return {data:table==='catalogue_items'?deal:table==='merchant_offers'?activeOffer:{permanent_listing:true,directory_status:'active'}}},insert(row){writes.push({table,row});return Promise.resolve({error:null})},then(resolve){resolve({count:0})}};return q}};
  const source=(await readFile(new URL(`../supabase/functions/${name}/index.ts`,import.meta.url),'utf8')).replace(/^import .*;\n/gm,'');
  vm.runInNewContext(stripTypeScriptTypes(source),{Deno:{serve:fn=>{handler=fn},env:{get:()=>''}},createClient:()=>client,isAutomatedAgent,isBotAnalyticsEvent,isPublicAnalyticsEvent,directoryVisible,navigationDestination,validDropId,Request,Response,URL,URLSearchParams,TextEncoder,crypto,console});
  return {handler,writes};
}

test('tracking endpoint ignores robots without database writes and still records normal browser events',async()=>{
  const {handler,writes}=await handlerFor('perkdrop-track');
  const request=agent=>new Request('https://example.test/track',{method:'POST',headers:{origin:'https://perkdrop.au','content-type':'application/json','user-agent':agent,'x-forwarded-for':'192.0.2.10'},body:JSON.stringify({event_type:'page_view',session_id:'test',source_page:'/events?private=hidden',referrer:'https://example.org/private?hidden=1',metadata:{path:'/events?private=hidden',traffic_type:'internal'}})});
  const botResponse=await handler(request(robot));assert.equal(botResponse.status,202);assert.equal((await botResponse.json()).ignored,'automated_traffic');assert.equal(writes.length,0);
  const humanResponse=await handler(request(human));assert.equal(humanResponse.status,202);assert.equal(writes.length,1);assert.equal(writes[0].row.event_type,'page_view');assert.equal(writes[0].row.source_page,'/events');assert.equal(writes[0].row.referrer,'https://example.org');assert.equal(writes[0].row.metadata.path,'/events');
});

test('official and claim redirects still work for bots without inflating click counts',async()=>{
  for(const claimed of [false,true]){
    const deal={id:'TEST',active:true,merchant_id:claimed?'merchant':null,metadata:claimed?{merchant_offer_id:'offer'}:{original_go_url:'https://venue.example/event'},source:'https://venue.example/event'};
    const {handler,writes}=await handlerFor('perkdrop-go',{deal,activeOffer:claimed?{id:'offer',status:'active'}:null});
    const req=agent=>new Request('https://example.test/go?drop=TEST&sid=a&internal=1',{headers:{'user-agent':agent,'x-forwarded-for':'192.0.2.10'}});
    const botResponse=await handler(req(robot));assert.equal(botResponse.status,302);assert.match(botResponse.headers.get('location'),claimed?/perkdrop-consumer-claim/:/venue\.example/);assert.equal(writes.length,0);
    const humanResponse=await handler(req(human));assert.equal(humanResponse.status,302);assert.equal(writes.length,2);assert.equal(writes[0].table,'outbound_clicks');
  }
});

test('directions remain usable for bots without recording a customer action',async()=>{
  const {handler,writes}=await handlerFor('perkdrop-nav',{deal:{id:'TEST',active:true,merchant_id:null,latitude:-34.9,longitude:138.6}});
  const req=agent=>new Request('https://example.test/nav?drop=TEST&sid=a&internal=1',{headers:{'user-agent':agent,'x-forwarded-for':'192.0.2.10'}});
  const botResponse=await handler(req(robot));assert.equal(botResponse.status,302);assert.match(botResponse.headers.get('location'),/google\.com\/maps\/dir/);assert.equal(writes.length,0);
  assert.equal((await handler(req(human))).status,302);assert.equal(writes.length,1);assert.equal(writes[0].row.event_type,'directions');
});
