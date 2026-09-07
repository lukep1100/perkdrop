import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=(process.env.SMOKE_BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const endpoint=`${base}/api/union-booking`;
const availability=await fetch(endpoint).then(response=>response.json());
assert.equal(availability.ok,true);
const [target,nextDay]=availability.sessions.filter(session=>session.capacity_remaining===20).slice(0,2);
assert.ok(target&&nextDay,'two untouched 20-seat sessions are required');

const created=[];
const post=body=>fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
const hold=async(party_size,label)=>{
  const session_id=`pd_union_stress_${label}_${randomUUID()}`;
  const response=await post({action:'hold',session_id,service_date:target.service_date,party_size});
  const body=await response.json();
  if(response.ok)created.push({session_id,hold_token:body.hold.token});
  return {status:response.status,body};
};

try{
  const concurrent=await Promise.all([6,6,6,6].map((size,index)=>hold(size,`race${index}`)));
  assert.equal(concurrent.filter(result=>result.status===201).length,3,'only three concurrent six-seat holds may fit');
  assert.equal(concurrent.filter(result=>result.status===409).length,1,'one concurrent hold must be rejected');

  let current=await fetch(endpoint).then(response=>response.json());
  assert.equal(current.sessions.find(session=>session.id===target.id).capacity_remaining,2);
  assert.equal(current.sessions.find(session=>session.id===nextDay.id).capacity_remaining,20,'next session capacity must remain independent');

  const finalTwo=await hold(2,'fill');
  assert.equal(finalTwo.status,201);
  const blocked=await hold(1,'blocked');
  assert.equal(blocked.status,409);
  assert.equal(blocked.body.error,'insufficient_capacity');
  current=await fetch(endpoint).then(response=>response.json());
  assert.equal(current.sessions.find(session=>session.id===target.id).capacity_remaining,0);
}finally{
  await Promise.all(created.map(item=>post({action:'release',session_id:item.session_id,hold_token:item.hold_token})));
}

const restored=await fetch(endpoint).then(response=>response.json());
assert.equal(restored.sessions.find(session=>session.id===target.id).capacity_remaining,20);
assert.equal(restored.sessions.find(session=>session.id===nextDay.id).capacity_remaining,20);
console.log(`Concurrent protection, sold-out rejection and session independence passed against ${base}; capacity restored.`);
