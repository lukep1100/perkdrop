import test from 'node:test';
import assert from 'node:assert/strict';
import {selectedAvailability,serviceWindows} from '../public/availability.mjs';
const now=new Date('2026-09-14T06:00:00Z');
const deal={state:'SA',qualityGrade:'A',availability:{reviewState:'checked',checkedAt:'2026-09-14T05:00:00Z',sourceUrl:'https://example.invalid/official',recurrence:'ongoing',windows:[{days:[1,2],start:'17:00',end:'21:00'}]}};
const selected={date:'2026-09-14',time:'19:00'};
test('selected-time uses reviewed windows with exclusive end and deterministic Adelaide dates',()=>{
  assert.equal(selectedAvailability(deal,selected,now).reason,'available');
  assert.equal(selectedAvailability(deal,{...selected,time:'16:00'},now).reason,'starts_later');
  assert.equal(selectedAvailability(deal,{...selected,time:'21:00'},now).reason,'service_finished');
  assert.equal(selectedAvailability(deal,{...selected,date:'2026-09-16'},now).reason,'wrong_weekday');
  assert.equal(selectedAvailability(deal,{...selected,date:'2026-09-15'},now).reason,'available');
  assert.equal(serviceWindows(deal,selected.date,now).length,1);
  assert.equal(selectedAvailability(deal,{...selected,date:'2026-02-30'},now).reason,'invalid_selection');
});
test('source, expiry, booking, public exclusion and area reasons remain distinct',()=>{
  const reason=(patch,selection={})=>selectedAvailability({...deal,...patch},{...selected,...selection},now).reason;
  assert.equal(reason({end:'2026-09-13'}),'expired');
  assert.equal(reason({availability:{...deal.availability,checkedAt:'2026-08-01T00:00:00Z'}}),'freshness_insufficient');
  assert.equal(reason({availability:{...deal.availability,windows:[]}}),'service_hours_unknown');
  assert.equal(reason({availability:{...deal.availability,reviewState:'conflicting'}}),'source_conflict');
  assert.equal(reason({bookingEvidence:'unresolved'}),'booking_unresolved');
  assert.equal(reason({merchantOfferId:'fixture',offerServiceDate:'2026-09-15',capacityRemaining:20}),'booking_unresolved');
  assert.equal(reason({publicVisible:false}),'business_excluded');
  assert.equal(reason({}, {insideArea:false}),'outside_area');
  assert.equal(reason({}, {dinnerEligible:false}),'not_dinner');
});
test('no expiry is invented for explicitly ongoing recurrence; unreviewed schedules still fail',()=>{
  const a=deal.availability;
  assert.equal(selectedAvailability({...deal,availability:{...a,recurrence:undefined}},selected,now).eligible,false);
  assert.equal(selectedAvailability({...deal,availability:{...a,reviewState:'unknown'}},selected,now).eligible,false);
  assert.equal(selectedAvailability(deal,selected,new Date('2026-10-20T00:00:00Z')).reason,'freshness_insufficient');
});
