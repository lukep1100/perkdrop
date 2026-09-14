import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function testNotificationReadiness(pool,check){
  // Reproduce the inspected production outbox/config shape, in the isolated cluster.
  await pool.query(`alter table merchant_notification_outbox
    add column attempt_count integer not null default 0,
    add column created_at timestamptz not null default now(),
    add column last_error text,add column sent_at timestamptz,add column processing_started_at timestamptz,
    add constraint merchant_notification_outbox_status_check check(status in ('pending','sent','failed','skipped'));
    create table merchant_notification_config(singleton boolean primary key default true,enabled boolean not null default false);
    insert into merchant_notification_config values(true,false);`);
  const mid=(await pool.query("insert into merchants(name,slug,primary_location,primary_state) values('Notification fixture',$1,'Isolated address','SA') returning id",[randomUUID()])).rows[0].id;
  const insert=async(event='claim_approved',created=null)=>(await pool.query("insert into merchant_notification_outbox(merchant_id,event_type,recipient_email,created_at) values($1,$2,'qa@example.invalid',coalesce($3,now())) returning id",[mid,event,created])).rows[0].id;
  const old=await insert('claim_approved',new Date(Date.now()-86400000));
  await check('reproduce production defect: processing violates legacy status constraint',async()=>{
    await assert.rejects(pool.query("update merchant_notification_outbox set status='processing' where id=$1",[old]),/status_check/);
  });
  await pool.query(await readFile(new URL('../../supabase/migrations/20260914115217_production_notification_readiness.sql',import.meta.url),'utf8'));
  await check('disabled sender and missing release gate cannot claim any messages',async()=>{
    assert.equal((await pool.query('select * from claim_merchant_notifications(20)')).rowCount,0);
    await pool.query('update merchant_notification_config set enabled=true');
    assert.equal((await pool.query('select * from claim_merchant_notifications(20)')).rowCount,0);
    await pool.query("update merchant_notification_config set release_after=now(),released_event_types=array['claim_approved']");
  });
  const eligible=await insert(),other=await insert('watch_match');
  await check('explicit release excludes old backlog and unrelated event types',async()=>{
    const rows=(await pool.query('select * from claim_merchant_notifications(20)')).rows;
    assert.deepEqual(rows.map(x=>x.id),[eligible]);assert.equal(rows[0].status,'processing');assert.equal(rows[0].attempt_count,1);
    for(const id of [old,other])assert.equal((await pool.query('select status from merchant_notification_outbox where id=$1',[id])).rows[0].status,'pending');
    assert.equal((await pool.query('select merchant_notification_send_allowed($1) allowed',[eligible])).rows[0].allowed,true);
  });
  await check('concurrent workers receive disjoint leases, and fresh leases are not retried',async()=>{
    await insert();await insert();const results=await Promise.all([pool.query('select id from claim_merchant_notifications(1)'),pool.query('select id from claim_merchant_notifications(1)')]);
    assert.equal(new Set(results.flatMap(r=>r.rows.map(x=>x.id))).size,2);
    assert.equal((await pool.query('select * from claim_merchant_notifications(20)')).rowCount,0);
  });
  await check('stale lease reuses bounded job, exhausted and aged attempts require reconciliation',async()=>{
    await pool.query("update merchant_notification_outbox set processing_started_at=now()-interval '11 minutes' where id=$1",[eligible]);
    assert.equal((await pool.query('select * from claim_merchant_notifications(20)')).rows[0].attempt_count,2);
    await pool.query("update merchant_notification_outbox set status='pending',attempt_count=5 where id=$1",[eligible]);
    await pool.query('select * from claim_merchant_notifications(20)');
    assert.equal((await pool.query('select status from merchant_notification_outbox where id=$1',[eligible])).rows[0].status,'delivery_unknown');
    const aged=await insert();await pool.query("update merchant_notification_outbox set attempt_count=1,first_attempt_at=now()-interval '24 hours' where id=$1",[aged]);
    await pool.query('select * from claim_merchant_notifications(20)');
    assert.equal((await pool.query('select status from merchant_notification_outbox where id=$1',[aged])).rows[0].status,'delivery_unknown');
  });
  await check('next-attempt time prevents hot-loop retries and zero limit claims nothing',async()=>{
    const deferred=await insert();await pool.query("update merchant_notification_outbox set next_attempt_at=now()+interval '1 hour' where id=$1",[deferred]);
    assert.equal((await pool.query('select * from claim_merchant_notifications(20)')).rowCount,0);
    await insert();assert.equal((await pool.query('select * from claim_merchant_notifications(0)')).rowCount,0);
  });
  await check('last-minute business suppression blocks alternate-address delivery',async()=>{
    const id=(await pool.query('select * from claim_merchant_notifications(1)')).rows[0].id;
    await pool.query('update merchants set do_not_contact=true where id=$1',[mid]);
    assert.equal((await pool.query('select merchant_notification_send_allowed($1) allowed',[id])).rows[0].allowed,false);
  });
  await check('notification payload, config and claim functions remain service-only',async()=>{
    const c=await pool.connect();try{
      await c.query('set role authenticated');
      await assert.rejects(c.query('select * from merchant_notification_outbox'),/permission denied/);
      await assert.rejects(c.query('select * from merchant_notification_config'),/permission denied/);
      await assert.rejects(c.query('select * from claim_merchant_notifications(1)'),/permission denied/);
    }finally{await c.query('reset role');c.release();}
  });
}
