import test from 'node:test';
import assert from 'node:assert/strict';
import {
  NOWBOOKIT_ORIGIN,buildNowBookItUrl,normaliseBookingEvent,nowBookItEventKind,
  parseNowBookItMessage,safeHoldToken,safePartySize,safeServiceDate,safeSessionId,
} from '../lib/union-pilot.mjs';

test('customer party sizes are limited to 1–6',()=>{
  for(let size=1;size<=6;size++)assert.equal(safePartySize(size),size);
  for(const size of [0,7,1.5,'not-a-number'])assert.equal(safePartySize(size),null);
});

test('booking identifiers are strictly validated',()=>{
  assert.equal(safeSessionId('pd_union_1234567890'),'pd_union_1234567890');
  assert.equal(safeSessionId('../bad'),'');
  assert.equal(safeServiceDate('2026-09-08'),'2026-09-08');
  assert.equal(safeServiceDate('08/09/2026'),'');
  assert.equal(safeHoldToken('71fcef88-1c8f-49f7-a9c0-effd65719880'),'71fcef88-1c8f-49f7-a9c0-effd65719880');
  assert.equal(safeHoldToken('not-a-token'),'');
});

test('NowBookIt URL is provider-locked and carries date, covers and bubble analytics',()=>{
  const url=new URL(buildNowBookItUrl(`${NOWBOOKIT_ORIGIN}/?venueid=5582`,'2026-09-08',4));
  assert.equal(url.origin,NOWBOOKIT_ORIGIN);
  assert.equal(url.searchParams.get('date'),'2026-09-08');
  assert.equal(url.searchParams.get('covers'),'4');
  assert.equal(url.searchParams.get('analytics'),'bubble');
  assert.throws(()=>buildNowBookItUrl('https://example.com','2026-09-08',2),/Invalid booking provider/);
});

test('only documented NowBookIt completion events confirm a claim',()=>{
  const confirmed=parseNowBookItMessage(JSON.stringify({type:'NBIWidget2GoogleAnalytics',event:{event_category:'Booking',event_action:'Booking Confirmed',event_label:'NBI-123'}}));
  assert.equal(nowBookItEventKind(confirmed),'confirmed');
  assert.equal(nowBookItEventKind({event_category:'Payment',event_action:'Booking Paid'}),'confirmed');
  assert.equal(nowBookItEventKind({event_category:'Page View',page_title:'Thank You'}),'confirmed');
  assert.equal(nowBookItEventKind({event_category:'Page View',page_title:'Customer Details'}),'progress');
  assert.equal(nowBookItEventKind({event_action:'Booking Cancelled'}),'cancelled');
  assert.equal(parseNowBookItMessage('{"type":"other"}'),null);
});

test('booking event payload is reduced to expected non-sensitive fields',()=>{
  const event=normaliseBookingEvent({event:'booking',eventAction:'Booking Confirmed',eventLabel:'NBI-123',unexpected:'discard me'});
  assert.deepEqual(Object.keys(event),['event','event_action','event_category','event_label','page_title','page_url']);
  assert.equal(event.event_action,'Booking Confirmed');
  assert.equal(event.event_label,'NBI-123');
});
