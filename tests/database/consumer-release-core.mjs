import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';

export async function testConsumerReleaseCore(pool,check){
  await pool.query(await readFile(new URL('../../supabase/migrations/20260924170000_consumer_release_core.sql',import.meta.url),'utf8'));
  const merchant=(await pool.query("insert into merchants(name,slug,primary_state,primary_city,permanent_listing,directory_status) values('Consumer release fixture',$1,'SA','adelaide',true,'active') returning id",[`consumer-release-${randomUUID()}`])).rows[0].id;
  const drop=`consumer-plan-${randomUUID()}`,slug=`consumer-plan-${randomUUID()}`;
  await pool.query(`insert into catalogue_items(id,merchant,title,description,category,kind,city,source,slug,detail_url,merchant_id,offer_origin,metadata)
    values($1,'Consumer release fixture','Fixture Drop','Current local fixture','Experiences','deal','adelaide','https://example.test',$2,'/deals/'||$2,$3,'merchant_submitted','{}')`,[drop,slug,merchant]);
  const consumer=(await pool.query('select marketplace_identity($1) id',[randomBytes(32).toString('hex')])).rows[0].id;
  await check('private plans are consumer-owned, item-ordered and not exposed to public roles',async()=>{
    const plan=(await pool.query("insert into marketplace_plans(consumer_id,name,planned_for,note) values($1,'Friday shortlist','2030-01-10','Meet at 6') returning id",[consumer])).rows[0].id;
    await pool.query('insert into marketplace_plan_items(plan_id,catalogue_item_id,position) values($1,$2,0)',[plan,drop]);
    assert.deepEqual((await pool.query('select name,planned_for::text as planned_for,note from marketplace_plans where id=$1',[plan])).rows[0],{name:'Friday shortlist',planned_for:'2030-01-10',note:'Meet at 6'});
    assert.equal((await pool.query("select has_table_privilege('anon','marketplace_plans','SELECT') ok")).rows[0].ok,false);
    assert.equal((await pool.query("select has_table_privilege('authenticated','marketplace_plan_items','SELECT') ok")).rows[0].ok,false);
  });
  await check('watch outbox projection creates a safe in-app update without exposing delivery payload',async()=>{
    const watch=(await pool.query("insert into marketplace_watches(consumer_id,name,rule) values($1,'Fixture watch','{\"city\":\"adelaide\"}') returning id",[consumer])).rows[0].id;
    const outbox=(await pool.query(`insert into marketplace_outbox(consumer_id,event,watch_id,dedupe_key,payload)
      values($1,'watch_match',$2,$3,jsonb_build_object('drop_id',$4::text,'offer_title','Ignored raw title','url','https://private.example/recovery')) returning id`,[consumer,watch,`watch-fixture-${randomUUID()}`,drop])).rows[0].id;
    const update=(await pool.query('select title,body,href,metadata from marketplace_consumer_updates where source_outbox_id=$1',[outbox])).rows[0];
    assert.equal(update.title,'A Drop matched your alert');
    assert.equal(update.body,'Consumer release fixture — Fixture Drop');
    assert.equal(update.href,`/deals/${slug}`);
    assert.deepEqual(update.metadata,{watch_id:watch,drop_id:drop});
    assert.equal((await pool.query("select has_table_privilege('anon','marketplace_consumer_updates','SELECT') ok")).rows[0].ok,false);
  });
  await check('plans and Radar updates honour the full public catalogue boundary',async()=>{
    const removedMerchant=(await pool.query("insert into merchants(name,slug,primary_state,primary_city,permanent_listing,directory_status) values('Removed fixture',$1,'SA','adelaide',true,'removed') returning id",[`removed-plan-${randomUUID()}`])).rows[0].id;
    const held=`consumer-held-${randomUUID()}`,expired=`consumer-expired-${randomUUID()}`,ended=`consumer-ended-${randomUUID()}`,removed=`consumer-removed-${randomUUID()}`;
    await pool.query(`insert into catalogue_items(id,merchant,title,description,category,kind,city,source,slug,detail_url,merchant_id,offer_origin,metadata)
      values
        ($1,'Consumer release fixture','Held fixture','Held for review','Experiences','deal','adelaide','https://example.test',$2,'/deals/'||$2,$3,'merchant_submitted','{"accuracy_hold":true}'),
        ($4,'Consumer release fixture','Expired fixture','Expired','Experiences','deal','adelaide','https://example.test',$5,'/deals/'||$5,$3,'merchant_submitted','{}'),
        ($6,'Consumer release fixture','Ended fixture','Ended','Events','event','adelaide','https://example.test',$7,'/deals/'||$7,$3,'merchant_submitted','{}'),
        ($8,'Removed fixture','Removed fixture','Removed from directory','Experiences','deal','adelaide','https://example.test',$9,'/deals/'||$9,$10,'merchant_submitted','{}')`,[
      held,`held-${randomUUID()}`,merchant,
      expired,`expired-${randomUUID()}`,
      ended,`ended-${randomUUID()}`,
      removed,`removed-${randomUUID()}`,removedMerchant,
    ]);
    await pool.query("update catalogue_items set end_date='2000-01-01' where id=$1",[expired]);
    await pool.query("update catalogue_items set ends_at=now()-interval '1 minute' where id=$1",[ended]);
    const visible=(await pool.query('select id from marketplace_public_catalogue_items($1::text[]) order by id',[[drop,held,expired,ended,removed]])).rows.map(row=>row.id);
    assert.deepEqual(visible,[drop]);
    const watch=(await pool.query("insert into marketplace_watches(consumer_id,name,rule) values($1,'Held watch','{\"city\":\"adelaide\"}') returning id",[consumer])).rows[0].id;
    const hiddenOutbox=(await pool.query(`insert into marketplace_outbox(consumer_id,event,watch_id,dedupe_key,payload)
      values($1,'watch_match',$2,$3,jsonb_build_object('drop_id',$4::text,'offer_title','Never expose this raw title')) returning id`,[consumer,watch,`held-watch-${randomUUID()}`,held])).rows[0].id;
    assert.equal(Number((await pool.query('select count(*) from marketplace_consumer_updates where source_outbox_id=$1',[hiddenOutbox])).rows[0].count),0);
    await assert.rejects(pool.query("insert into marketplace_consumer_updates(consumer_id,kind,title,href) values($1,'system','Unsafe path',$2)",[consumer,'/\\evil.example']),/violates check constraint/);
  });
}
