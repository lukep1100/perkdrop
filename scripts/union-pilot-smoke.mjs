import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=(process.env.SMOKE_BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const page=await fetch(`${base}/deals/union-hotel-20-off-lunch`);
assert.equal(page.status,200,'Union Hotel page should return HTTP 200');
assert.match(page.headers.get('content-type')||'',/^text\/html\b/i,'deal page must be text/html');
const html=await page.text();
assert.match(html,/20% OFF FOOD/);
assert.match(html,/purchase of a drink required/i);
assert.doesNotMatch(html,/&lt;!doctype html/i,'page must not render HTML source as text');

const availabilityResponse=await fetch(`${base}/api/union-booking`,{headers:{accept:'application/json'}});
assert.equal(availabilityResponse.status,200,'availability endpoint should return HTTP 200');
assert.match(availabilityResponse.headers.get('content-type')||'',/^application\/json\b/i);
const availability=await availabilityResponse.json();
assert.equal(availability.ok,true);
assert.equal(availability.offer.discount_percent,20);
assert.equal(availability.offer.id,'5f1a5ca3-30ba-4747-869a-0a60edb596c7');
assert.equal(new URL(availability.offer.booking_url).hostname,'bookings.nowbookit.com');
assert.match(availability.offer.conditions,/Purchase of a drink required/i);
assert.ok(availability.sessions.length>0,'eligible lunch sessions should be returned');
for(const session of availability.sessions){
  assert.equal(session.capacity_total,20);
  assert.ok(session.capacity_remaining>=0&&session.capacity_remaining<=20);
  assert.match(session.service_date,/^\d{4}-\d{2}-\d{2}$/);
  assert.equal(session.service_start,'11:30');
  assert.equal(session.service_end,'14:30');
}

for(const party_size of [0,7]){
  const response=await fetch(`${base}/api/union-booking`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'hold',session_id:`pd_union_smoke_${randomUUID()}`,service_date:availability.sessions[0].service_date,party_size})});
  assert.equal(response.status,400,`party size ${party_size} must be rejected`);
}

if(process.env.MUTATING_BOOKING_SMOKE==='1'){
  const target=availability.sessions.find(session=>session.capacity_remaining>=6);
  assert.ok(target,'a session with six spots is required for the hold/release smoke');
  const session_id=`pd_union_smoke_${randomUUID()}`;
  const held=await fetch(`${base}/api/union-booking`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'hold',session_id,service_date:target.service_date,party_size:6})});
  assert.equal(held.status,201);
  const hold=await held.json();
  assert.equal(hold.hold.party_size,6);
  assert.equal(hold.capacity_remaining,target.capacity_remaining-6);
  const during=await (await fetch(`${base}/api/union-booking`)).json();
  assert.equal(during.sessions.find(item=>item.service_date===target.service_date).capacity_remaining,target.capacity_remaining-6);
  const released=await fetch(`${base}/api/union-booking`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'release',session_id,hold_token:hold.hold.token})});
  assert.equal(released.status,200);
  const release=await released.json();
  assert.equal(release.released,true);
  const after=await (await fetch(`${base}/api/union-booking`)).json();
  assert.equal(after.sessions.find(item=>item.service_date===target.service_date).capacity_remaining,target.capacity_remaining);
}

console.log(`Union pilot smoke passed against ${base}${process.env.MUTATING_BOOKING_SMOKE==='1'?' with hold/release':' (read-only)'}.`);
