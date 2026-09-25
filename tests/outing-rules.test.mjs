import test from 'node:test';import assert from 'node:assert/strict';
import {groupCost,matchesOuting,planCalendar,distanceKm} from '../public/outing-rules.mjs';
import {venueKey} from '../public/venue-identity.mjs';
test('budget excludes unknown and conditional free admission; explicit age prices calculate group cost',()=>{
 assert.equal(groupCost({price:'Kids eat free with a paying adult'}).known,false);
 assert.equal(matchesOuting({price:'From $10'},{budget:50}),false);
 assert.equal(groupCost({price:'Free'},{adults:2,ages:[5,8]}).total,0);
 const d={pricing:{verified:true,currency:'AUD',basis:'age_bands',adult:12,children:[{min:0,max:12,amount:5}]}};
 assert.equal(groupCost(d,{adults:2,ages:[5,8]}).total,34);
 assert.equal(groupCost(d,{adults:2,ages:[16]}).known,false);
});
test('family and access preferences require affirmative evidence',()=>{
 assert.equal(matchesOuting({title:'Fun for all the family'},{ages:[4]}),false);
 assert.equal(matchesOuting({suitability:{verified:true,minAge:5,maxAge:12,setting:'indoor',wheelchair:true}},{ages:[5,8],setting:'indoor',accessible:true}),true);
 assert.equal(matchesOuting({suitability:{verified:true,minAge:5,maxAge:12}},{ages:[4,8]}),false);
});
test('stable venue IDs survive coordinate corrections and branches remain distinct',()=>{
 assert.equal(venueKey({venueId:'venue:agsa',latitude:-34.9}),venueKey({venueId:'venue:agsa',latitude:-34.921}));
 assert.notEqual(venueKey({merchant:'Same brand',location:'1 Main St'}),venueKey({merchant:'Same brand',location:'4 Other St'}));
 assert.equal(distanceKm({latitude:null,longitude:null},{latitude:-34,longitude:138}),null);
});
test('calendar export escapes event content, folds UTF-8 safely, and includes an explicit reminder',()=>{
 const ics=planCalendar({id:'example',name:'Family, fun; day\nBEGIN:VEVENT',planned_for:'2026-10-04',items:[{merchant:'Gallery',title:'Exhibition',href:'/deals/example'}]});
 assert.match(ics,/DTSTART;VALUE=DATE:20261004/);assert.match(ics,/DTEND;VALUE=DATE:20261005/);assert.match(ics,/TRIGGER:-PT12H/);assert.equal((ics.match(/\r\nBEGIN:VEVENT/g)||[]).length,1);
 assert.ok(ics.split('\r\n').every(line=>Buffer.byteLength(line)<=75));
});
