import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { Pool } from 'pg';

// Never accepts a database URL: this runner can only touch its own temporary cluster.
const platform = process.platform === 'win32' ? 'windows' : process.platform;
const binaries = await import(`@embedded-postgres/${platform}-${process.arch}`);
const root = await mkdtemp(path.join(tmpdir(), 'perkdrop-db-test-'));
const data = path.join(root, 'data');
const password = randomBytes(32).toString('hex');
const passwordFile = path.join(root, 'password');
await writeFile(passwordFile, password, { mode: 0o600 });
const port = await new Promise(resolve => {
  const probe = net.createServer();
  probe.listen(0, '127.0.0.1', () => {
    const value = probe.address().port;
    probe.close(() => resolve(value));
  });
});
function run(binary, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { windowsHide: true });
    let output = '';
    child.stdout.on('data', value => { output += value; });
    child.stderr.on('data', value => { output += value; });
    child.on('error', reject);
    child.on('exit', code => {
      child.stdout.destroy();
      child.stderr.destroy();
      code === 0 ? resolve(output) : reject(new Error(output));
    });
  });
}
let started = false;
let pool;
let count = 0;
async function check(name, fn) {
  await fn();
  count++;
  console.log(`REAL DATABASE PASS: ${name}`);
}
try {
  await run(binaries.initdb, ['-D', data, '-U', 'postgres', '--auth=scram-sha-256', `--pwfile=${passwordFile}`, '--encoding=UTF8', '--locale=C']);
  await rm(passwordFile);
  await run(binaries.pg_ctl, ['-D', data, '-l', path.join(root, 'postgres.log'), '-o', `-h 127.0.0.1 -p ${port}`, '-w', 'start']);
  started = true;
  pool = new Pool({ host: '127.0.0.1', port, user: 'postgres', password, database: 'postgres', max: 24 });
  await pool.query(await readFile(new URL('../tests/database/production-core.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../supabase/release/marketplace-safety.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../supabase/release/marketplace-commercial.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../supabase/release/marketplace-consumer.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../supabase/release/marketplace-demand.sql', import.meta.url), 'utf8'));
  await pool.query(await readFile(new URL('../supabase/release/marketplace-operations.sql', import.meta.url), 'utf8'));
  console.log('Testing exported production RPC baseline, not full Supabase RLS/PostGIS/HTTP stack.');
  const merchant = (await pool.query("insert into merchants(name,slug,primary_state,primary_city) values ('Isolated acceptance fixture',$1,'SA','adelaide') returning id", [`test-${randomUUID()}`])).rows[0].id;
  async function offer(capacity, unit = 'ticket', action = 'redemption_code') {
    return (await pool.query(`insert into merchant_offers(merchant_id,title,description,conditions,location,city,state,status,action_type,inventory_unit,capacity_total,capacity_remaining,normal_price,deal_price,starts_at,ends_at)
      values ($1,'Isolated offer','Test only','Test only','Test location','adelaide','SA','active',$4,$3,$2,$2,120,90,now()-interval '1 hour',now()+interval '2 days') returning id`, [merchant, capacity, unit, action])).rows[0].id;
  }
  const claim = (id, session = randomUUID(), quantity = 1) => pool.query('select claim_merchant_offer($1,null,$2,$3,$4) as result', [id, session, quantity, `PD-${randomBytes(8).toString('hex').toUpperCase()}`]);
  for (const [capacity, unit] of [[1, 'appointment'], [2, 'ticket'], [20, 'diner']]) {
    await check(`${capacity} ${unit}: 24 independent concurrent claim requests`, async () => {
      const id = await offer(capacity, unit);
      const results = await Promise.allSettled(Array.from({ length: 24 }, () => claim(id)));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, capacity);
      for (const result of results.filter(result => result.status === 'rejected')) assert.match(result.reason.message, /insufficient_capacity/);
      assert.equal((await pool.query('select capacity_remaining from merchant_offers where id=$1', [id])).rows[0].capacity_remaining, 0);
      assert.equal(Number((await pool.query('select sum(party_size) as units from redemptions where merchant_offer_id=$1', [id])).rows[0].units), capacity);
    });
  }
  await check('concurrent retry returns one entitlement and consumes capacity once', async () => {
    const id = await offer(2);
    const session = randomUUID();
    const results = await Promise.all(Array.from({ length: 12 }, () => claim(id, session)));
    assert.equal(new Set(results.map(result => result.rows[0].result.redemption.id)).size, 1);
    assert.equal((await pool.query('select capacity_remaining from merchant_offers where id=$1', [id])).rows[0].capacity_remaining, 1);
  });
  await check('booking-first and external fulfilment reject generic direct claims', async () => {
    await assert.rejects(claim(await offer(20, 'diner', 'booking_claim')), /direct_claim_not_allowed/);
    const id = await offer(1, 'appointment');
    await pool.query("update merchant_offers set fulfilment_mode='external_booking' where id=$1", [id]);
    await assert.rejects(claim(id), /direct_claim_not_allowed/);
  });
  await check('anon and authenticated cannot execute privileged RPCs', async () => {
    const client = await pool.connect();
    try {
      for (const role of ['anon', 'authenticated']) {
        await client.query(`set role ${role}`);
        await assert.rejects(client.query('select claim_merchant_offer($1,null,$2,1,$3)', [randomUUID(), randomUUID(), 'PD-DENIED']), /permission denied/);
        await client.query('reset role');
      }
    } finally { await client.query('reset role'); client.release(); }
  });
  await check('wrong merchant cannot redeem; concurrent redemption posts one fee', async () => {
    await pool.query("insert into merchant_commercial_terms(merchant_id,model,commission_flat,status,effective_from) values ($1,'per_unit',2,'active',now()-interval '1 day')", [merchant]);
    const result = (await claim(await offer(1))).rows[0].result.redemption;
    await assert.rejects(pool.query('select redeem_merchant_redemption_with_spend($1,$2)', [randomUUID(), result.redemption_code]), /redemption_not_found/);
    const results = await Promise.allSettled(Array.from({ length: 12 }, () => pool.query('select redeem_merchant_redemption_with_spend($1,$2)', [merchant, result.redemption_code])));
    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    for (const result of results.filter(result => result.status === 'rejected')) assert.match(result.reason.message, /redemption_not_available/);
    const ledger = (await pool.query('select count(*) as count,sum(perkdrop_value) as fee from commission_ledger where redemption_id=$1', [result.id])).rows[0];
    assert.equal(Number(ledger.count), 1);
    assert.equal(Number(ledger.fee), 2);
  });
  await check('expired entitlement cannot redeem', async () => {
    const result = (await claim(await offer(1))).rows[0].result.redemption;
    await pool.query("update redemptions set expires_at=now()-interval '1 second' where id=$1", [result.id]);
    await assert.rejects(pool.query('select redeem_merchant_redemption_with_spend($1,$2)', [merchant, result.redemption_code]), /redemption_expired/);
  });
  await check('production shared fee calculator covers all commercial models', async () => {
    for (const [model, expected] of [['per_unit',6],['per_booking',2],['percentage_of_tracked_value',9],['subscription',0],['hybrid',15],['none',0]]) {
      const row = (await pool.query('select marketplace_fee($1,3,90,2,0.1) as fee', [model])).rows[0];
      assert.equal(Number(row.fee),expected,model);
    }
    await assert.rejects(pool.query("select marketplace_fee('per_unit',0,90,2,0.1)"), /invalid_fee_inputs/);
  });
  await check('merchant ownership, draft approval boundary, capacity/claim race and close', async () => {
    const actor = randomUUID();
    await pool.query('insert into merchant_members(merchant_id,user_id) values($1,$2)', [merchant, actor]);
    const id = await offer(20);
    const control = (who, action, capacity = null) => pool.query('select merchant_offer_control($1,$2,$3,$4,$5)', [who, merchant, id, action, capacity]);
    await assert.rejects(control(randomUUID(), 'offer_capacity', 1), /merchant_access_denied/);
    await pool.query("update merchant_offers set status='draft' where id=$1", [id]);
    await assert.rejects(control(actor, 'offer_resume'), /offer_not_resumable/);
    await pool.query("update merchant_offers set status='active' where id=$1", [id]);
    await Promise.all([...Array.from({ length: 10 }, () => claim(id)), control(actor, 'offer_capacity', 15)]);
    const row = (await pool.query('select capacity_total,capacity_remaining from merchant_offers where id=$1', [id])).rows[0];
    assert.deepEqual(row, { capacity_total: 15, capacity_remaining: 5 });
    await assert.rejects(control(actor, 'offer_capacity', 9), /capacity_below_already_claimed/);
    await control(actor, 'offer_close');
    await assert.rejects(claim(id), /redemption_not_available/);
  });
  await check('real hold/release/expiry/confirmation transaction regression', async () => {
    await pool.query(await readFile(new URL('./union-booking-transactional-test.sql', import.meta.url), 'utf8'));
  });
  await check('beauty cancellation: pending, decline/timeout restore once, confirm, pass and fee', async () => {
    const actor=randomUUID(), credential=randomBytes(32).toString('hex');
    await pool.query('insert into merchant_members(merchant_id,user_id) values($1,$2)',[merchant,actor]);
    const id=await offer(1,'appointment');
    await pool.query("update merchant_offers set fulfilment_mode='merchant_confirmation',vertical='beauty',drop_type='cancellation',starts_at=now()+interval '1 day' where id=$1",[id]);
    const request=()=>pool.query('select marketplace_claim($1,$2,1) as result',[credential,id]);
    const decision=(rid,accept)=>pool.query('select marketplace_confirm($1,$2,$3,$4) as result',[actor,merchant,rid,accept]);
    let redemption=(await request()).rows[0].result.redemption;
    assert.equal(redemption.status,'pending');
    assert.match(redemption.pass_reference,/^[a-f0-9]{64}$/);
    assert.equal(Number(redemption.gross_value),120);
    assert.equal(Number(redemption.discount_value),30);
    await assert.rejects(pool.query('select redeem_merchant_redemption($1,$2)',[merchant,redemption.redemption_code]),/redemption_not_available/);
    const declines=await Promise.all([decision(redemption.id,false),decision(redemption.id,false)]);
    assert.equal(declines.filter(r=>r.rows[0].result.changed).length,1);
    assert.equal((await pool.query('select capacity_remaining from merchant_offers where id=$1',[id])).rows[0].capacity_remaining,1);
    redemption=(await request()).rows[0].result.redemption;
    await pool.query("update redemptions set expires_at=now()-interval '1 second' where id=$1",[redemption.id]);
    await Promise.all([pool.query('select marketplace_expire_pending($1)',[id]),pool.query('select marketplace_expire_pending($1)',[id])]);
    assert.equal((await pool.query('select capacity_remaining from merchant_offers where id=$1',[id])).rows[0].capacity_remaining,1);
    redemption=(await request()).rows[0].result.redemption;
    assert.equal((await decision(redemption.id,true)).rows[0].result.redemption.status,'created');
    await assert.rejects(pool.query('select redeem_merchant_redemption($1,$2)',[merchant,redemption.redemption_code]),/service_not_started/);
    await pool.query("update redemptions set metadata=metadata||jsonb_build_object('valid_from',now()-interval '1 hour') where id=$1",[redemption.id]);
    const redeemed=(await pool.query('select redeem_merchant_redemption($1,$2) as result',[merchant,redemption.redemption_code])).rows[0].result;
    assert.equal(redeemed.status,'redeemed');
    assert.equal(Number(redeemed.metadata.tracked_net),90);
    assert.equal(Number(redeemed.commission_value),2);
  });
  await check('event 15-ticket fixture: concurrent quantity claims sell out exactly',async()=>{
    const id=await offer(15,'ticket');
    await pool.query("update merchant_offers set normal_price=30,deal_price=20,vertical='events' where id=$1",[id]);
    const results=await Promise.allSettled(Array.from({length:12},()=>pool.query('select marketplace_claim($1,$2,3) as result',[randomBytes(32).toString('hex'),id])));
    assert.equal(results.filter(r=>r.status==='fulfilled').length,5);
    for(const r of results.filter(r=>r.status==='rejected'))assert.match(r.reason.message,/insufficient_capacity/);
    const row=(await pool.query('select sum(party_size) as units,sum(gross_value) as gross,sum(discount_value) as discount from redemptions where merchant_offer_id=$1',[id])).rows[0];
    assert.equal(Number(row.units),15);assert.equal(Number(row.gross),450);assert.equal(Number(row.discount),150);
  });
  await check('recovery expiry/tampering/single use/credential rotation and DB rate cap',async()=>{
    const credential=randomBytes(32).toString('hex'),token=randomBytes(32).toString('hex'),rotated=randomBytes(32).toString('hex');
    const cid=(await pool.query('select marketplace_identity($1) as id',[credential])).rows[0].id;
    await pool.query("insert into marketplace_recovery(consumer_id,token_hash,expires_at) values($1,$2,now()+interval '15 minutes')",[cid,token]);
    assert.equal((await pool.query('select marketplace_recover($1,$2) as ok',[randomBytes(32).toString('hex'),rotated])).rows[0].ok,false);
    const results=await Promise.all(Array.from({length:5},()=>pool.query('select marketplace_recover($1,$2) as ok',[token,rotated])));
    assert.equal(results.filter(r=>r.rows[0].ok).length,1);
    assert.equal((await pool.query('select credential_hash from marketplace_consumers where id=$1',[cid])).rows[0].credential_hash,rotated);
    const rates=await Promise.all(Array.from({length:10},()=>pool.query("select marketplace_rate_limit('fixture',3,3600) as ok")));
    assert.equal(rates.filter(r=>r.rows[0].ok).length,3);
  });
  await check('production demand aggregation: 9 hidden, 10 visible, no PII, expired excluded',async()=>{
    const actor=randomUUID();await pool.query('insert into merchant_members(merchant_id,user_id) values($1,$2)',[merchant,actor]);
    const aggregate=async()=> (await pool.query('select marketplace_demand($1,$2) as result',[actor,merchant])).rows[0].result;
    const consumers=[];
    for(let i=0;i<10;i++){
      const cid=(await pool.query('select marketplace_identity($1) as id',[randomBytes(32).toString('hex')])).rows[0].id;consumers.push(cid);
      await pool.query("select marketplace_standby($1,'adelaide','beauty','tomorrow afternoon','norwood',1,5,90,now()+interval '1 day')",[cid]);
      if(i===8)assert.deepEqual(await aggregate(),[]);
    }
    const data=await aggregate();assert.equal(data.length,1);assert.equal(data[0].distinct_users,10);assert.equal(data[0].quantity_requested,10);
    assert.deepEqual(Object.keys(data[0]).sort(),['city','distinct_users','precinct','quantity_requested','time_window','vertical'].sort());
    await pool.query("update demand_signals set expires_at=now()-interval '1 second' where consumer_id=$1",[consumers[0]]);assert.deepEqual(await aggregate(),[]);
  });
  await check('production SQL matcher: distance, time, quiet hours, dedupe and frequency cap',async()=>{
    const cid=(await pool.query('select marketplace_identity($1) as id',[randomBytes(32).toString('hex')])).rows[0].id;
    const id=await offer(1,'appointment');
    await pool.query("update merchant_offers set vertical='beauty',latitude=-34.9285,longitude=138.6007,starts_at='2030-01-10 03:00Z',ends_at='2030-01-11 06:00Z' where id=$1",[id]);
    const rule={city:'adelaide',verticals:['beauty'],times:['lunch'],latitude:-34.9285,longitude:138.6007,radius_km:5,quiet_start:22,quiet_end:7,daily_cap:1,timezone:'Australia/Adelaide'};
    await pool.query("insert into marketplace_watches(consumer_id,name,rule) values($1,'test watch',$2)",[cid,rule]);
    const match=async(r,at='2030-01-10 03:00Z')=>(await pool.query('select marketplace_watch_matches($1,o,$3) as matches from merchant_offers o where id=$2',[r,id,at])).rows[0].matches;
    assert.equal(await match(rule),true);assert.equal(await match({...rule,latitude:0}),false);assert.equal(await match({...rule,times:['evening']}),false);assert.equal(await match(rule,'2030-01-10 14:00Z'),false);
    assert.equal(Number((await pool.query("select marketplace_match_notifications('2030-01-10 03:00Z') as count")).rows[0].count),1);
    assert.equal(Number((await pool.query("select marketplace_match_notifications('2030-01-10 03:00Z') as count")).rows[0].count),0);
    const entries=(await pool.query('select status,recipient from marketplace_outbox where consumer_id=$1',[cid])).rows;
    assert.deepEqual(entries,[{status:'pending_provider',recipient:null}]);
  });
  console.log(`REAL DATABASE: ${count} checks passed. No production connection or fixture writes.`);
} finally {
  if (pool) await pool.end();
  if (started) await run(binaries.pg_ctl, ['-D', data, '-m', 'fast', '-w', 'stop']);
  // Exact mkdtemp child only; never removes a supplied path or existing workspace.
  assert.equal(path.dirname(root), path.resolve(tmpdir()));
  assert.ok(path.basename(root).startsWith('perkdrop-db-test-'));
  await rm(root, { recursive: true, force: true });
}
