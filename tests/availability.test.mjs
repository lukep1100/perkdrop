import test from 'node:test';
import assert from 'node:assert/strict';
import {availabilityMatches,localClock,freshness,serviceWindows} from '../public/availability.mjs';
import {searchMatches} from '../public/discovery-rules.mjs';
const monday=new Date('2026-09-14T09:00:00Z');
const deal=(patch={})=>({state:'SA',qualityGrade:'A',availability:{reviewState:'checked',checkedAt:'2026-09-14T08:00:00Z',sourceUrl:'https://example.com/offer',validFrom:'2026-09-14',validUntil:'2026-10-14',windows:[{days:[1],start:'17:00',end:'21:00'}]},...patch});
test('Monday evening is eligible only during remaining source-backed service',()=>{
 assert.equal(availabilityMatches(deal(),'tonight',monday),true);
 assert.equal(availabilityMatches(deal(),'tonight',new Date('2026-09-14T11:30Z')),false);
 assert.equal(availabilityMatches(deal(),'tonight',new Date('2026-09-15T09:00Z')),false);
});
test('Vague TONIGHT titles and unknown times never qualify',()=>{
 assert.equal(availabilityMatches({title:'FREE TONIGHT',state:'SA'},'tonight',monday),false);
 const d=deal();d.availability.windows[0].end='late';assert.equal(availabilityMatches(d,'tonight',monday),false);
});
test('Source freshness, future verification, conflicts and expiry fail closed',()=>{
 for(const patch of [{checkedAt:'2026-08-01T00:00Z'},{checkedAt:'2026-10-01T00:00Z'},{reviewState:'conflicting'},{validUntil:'2026-09-13'},{sourceUrl:''}]){const d=deal();Object.assign(d.availability,patch);assert.equal(availabilityMatches(d,'tonight',monday),false);}
});
test('Public-holiday exclusions and daily closing boundaries apply',()=>{
 const d=deal();d.availability.excludedDates=['2026-09-14'];assert.deepEqual(serviceWindows(d,'2026-09-14',monday),[]);
 assert.equal(availabilityMatches(deal({qualityGrade:'D'}),'tonight',monday),false);
});
test('Australia local date, half-hour zones and daylight savings are respected',()=>{
 assert.equal(localClock('SA',new Date('2026-09-14T14:45Z')).date,'2026-09-15');
 assert.equal(localClock('WA',new Date('2026-09-14T14:45Z')).date,'2026-09-14');
 assert.equal(localClock('SA',new Date('2026-10-04T00:00Z')).minutes,630);
 assert.equal(localClock('NT',new Date('2026-10-04T00:00Z')).minutes,570);
 assert.equal(localClock('UNKNOWN'),null);
});
test('Explicit dates do not become weekly occurrences or continuous festival dates',()=>{
 const d=deal();d.availability.windows=[{dates:['2026-09-19'],start:'17:00',end:'21:00'}];
 assert.equal(availabilityMatches(d,'tonight',monday),false);assert.equal(availabilityMatches(d,'weekend',monday),true);assert.equal(availabilityMatches(d,'week',monday),true);
});
test('Lunch never qualifies tonight and live capacity must match the service date',()=>{
 const d=deal();d.availability.windows=[{days:[1,2,3,4],start:'11:30',end:'14:30'}];assert.equal(availabilityMatches(d,'tonight',monday),false);
 const booking=deal({merchantOfferId:'existing',offerServiceDate:'2026-09-15',capacityRemaining:20});assert.equal(availabilityMatches(booking,'tonight',monday),false);booking.offerServiceDate='2026-09-14';booking.capacityRemaining=0;assert.equal(availabilityMatches(booking,'tonight',monday),false);
});
test('Ordinary search terms work without promising semantic precision',()=>{
 for(const [text,q] of [['Tuesday schnitzels','schnitty'],['Kids eat free with main meal','kids eat free'],['family museum','things to do'],['pizza food deal','cheap dinner'],['Italian restaurant pasta','date night'],['FREE gallery entry','free stuff'],['Adelaide SA 5000 lunch','Adelaide CBD'],['Hotel dining','pub']])assert.equal(searchMatches(text,q),true,q);
 assert.equal(searchMatches('Pub meal with a drink','kids eat free'),false);
});
test('Last checked labels are based on source evidence, never page render time',()=>{
 assert.match(freshness(deal(),monday).label,/14 Sept? 2026/);
 assert.equal(freshness({verified:'Today'},monday).state,'unknown');
});
