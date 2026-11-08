import test from 'node:test';
import assert from 'node:assert/strict';
import { quickDiscoveryPlans, searchRadius, distanceFrom, inSearchArea, widerArea, discoveryCollections, discoveryMatches, mergeDiscoveryListings } from '../public/local-discovery.mjs';
const now=new Date('2026-11-08T02:00:00Z');
const origin={latitude:-34.9285,longitude:138.6007,radius:10};
const listing=(id,latitude=-34.9285,extra={})=>({id,merchant:id,title:id,location:id,latitude,longitude:138.6007,qualityGrade:'A',state:'SA',kind:'event',price:'Free',source:'https://official.example/event',lastVerifiedAt:'2026-11-07T02:00:00Z',scheduleVerifiedAt:'2026-11-07T02:00:00Z',startsAt:'2026-11-09T01:00:00Z',endsAt:'2026-11-09T04:00:00Z',...extra});
test('radius is bounded and exact distance never treats unknown coordinates as nearby',()=>{
  assert.equal(searchRadius(500),200);assert.equal(searchRadius('bad'),25);assert.equal(searchRadius(0),25);
  assert.equal(distanceFrom(listing('local'),origin),0);assert.equal(inSearchArea(listing('far',-35.3),origin),false);
  for(const latitude of [null,'',NaN,0]){assert.equal(distanceFrom(listing('unknown',latitude),origin),null);assert.equal(inSearchArea(listing('unknown',latitude),origin),false);}
});
test('empty-area expansion finds a real matching radius, deduplicates places and does not mutate the selected radius',()=>{
  const nearby=listing('next',-35.1),same={...nearby,id:'same'};
  const result=widerArea([nearby,same,listing('remote',-40),listing('expired',-35.1,{endsAt:'2026-11-07T04:00:00Z'})],origin,now);
  assert.equal(result.radius,25);assert.equal(result.count,1);assert.equal(origin.radius,10);assert.equal(widerArea([listing('remote',-40)],origin,now),null);
});
test('suggested free plans retain photo-less events but exclude conditional freebies, expired and unreviewed listings',()=>{
  const rows=[listing('no-photo'),listing('conditional',-34.93,{title:'Kids eat free with a paying adult'}),listing('old',-34.93,{endsAt:'2026-11-07T02:00:00Z'}),listing('unknown',-34.93,{qualityGrade:'C'}),listing('stale',-34.93,{lastVerifiedAt:'2026-01-01T00:00:00Z',scheduleVerifiedAt:''})];
  assert.deepEqual(discoveryCollections(rows,{origin},now).free.map(x=>x.id),['no-photo']);
});
test('wider suggestions can preserve query, category and reviewed date filters',()=>{
  assert.equal(discoveryMatches(listing('gallery',-35.1,{title:'Free gallery workshop'}),{query:'gallery',category:'Free',when:'week'},now),true);
  assert.equal(discoveryMatches(listing('paid',-35.1,{price:'$20'}),{category:'Free'},now),false);
  assert.equal(discoveryMatches(listing('cancelled',-35.1,{availability:{status:'cancelled'}}),{},now),false);
  assert.equal(discoveryMatches(listing('unknown-hours'),{when:'now'},now),false);
});

test('focused rows win over a full national feed without exceeding its cache ceiling',()=>{
  const base=Array.from({length:500},(_,i)=>listing('national-'+i));
  const local=listing('new-local');const merged=mergeDiscoveryListings(base,[local,{...base[0],title:'Refreshed local version'},listing('old',-35,{endsAt:'2026-11-07T00:00:00Z'})],now);
  assert.equal(merged.length,500);assert.equal(merged[0].id,'new-local');assert.equal(merged.find(item=>item.id==='national-0').title,'Refreshed local version');assert.ok(!merged.some(item=>item.id==='old'));
});

test('quick plans count checked unique places in the selected circle, beyond the display rail limit',()=>{
  const rows=Array.from({length:12},(_,i)=>listing('place-'+i));
  rows.push({...rows[0],id:'duplicate'},listing('far',-40),listing('conditional',-34.93,{title:'Kids free with a paying adult'}),listing('stale',-34.93,{lastVerifiedAt:'2025-01-01',scheduleVerifiedAt:''}),listing('expired',-34.93,{endsAt:'2026-11-07T02:00:00Z'}));
  const plans=quickDiscoveryPlans(rows,{origin},now);
  assert.equal(plans.find(plan=>plan.id==='free').count,12);
  assert.equal(plans.find(plan=>plan.id==='tonight').count,0);
  assert.equal(origin.radius,10);
});

test('saved interests survive a changed area or filter and recommendation explanations never mutate catalogue rows',()=>{
  const saved=listing('saved-away',-40,{vertical:'food',price:'$20'}),food=listing('restaurant',-34.93,{vertical:'food',price:'$25'}),event=listing('event',-34.93,{vertical:'events'});
  const result=discoveryCollections([event,food],{origin,savedIds:[saved.id],catalogue:[saved,event,food]},now);
  assert.equal(result.personalised,true);
  assert.equal(result.suggested[0].id,'restaurant');
  assert.equal(result.suggested[0].discoveryReason,'Matches your interests');
  assert.equal(food.discoveryReason,undefined);
  assert.equal(discoveryCollections([event,food],{origin,preferences:{verticals:['food']}},now).suggested[0].id,'restaurant');
});
