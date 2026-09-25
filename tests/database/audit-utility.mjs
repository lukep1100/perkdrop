import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';import {randomUUID} from 'node:crypto';
export async function testAuditUtility(pool,check){
 await pool.query(await readFile(new URL('../../supabase/migrations/20260925085144_audit_discovery_integrity.sql',import.meta.url),'utf8'));
 await check('canonical venues survive corrected coordinates and stay private to service operations',async()=>{
  const id='audit-'+randomUUID();await pool.query(`insert into catalogue_items(id,merchant,title,description,category,kind,city,state,location,source,slug,detail_url,latitude,longitude) values($1,'Audit fixture','Event','Fixture','Events','event','adelaide','SA','1 Test Street','https://example.test',$1,'/deals/'||$1,-34.9,138.6)`,[id]);
  const first=(await pool.query('select venue_id from catalogue_items where id=$1',[id])).rows[0].venue_id;assert.ok(first);
  await pool.query('update catalogue_items set latitude=-34.91 where id=$1',[id]);assert.equal((await pool.query('select venue_id from catalogue_items where id=$1',[id])).rows[0].venue_id,first);
  assert.equal((await pool.query("select has_table_privilege('anon','discovery_venues','SELECT') ok")).rows[0].ok,false);
 });
 await check('changing event time without renewed evidence invalidates the prior schedule',async()=>{
  const id='audit-time-'+randomUUID();await pool.query(`insert into catalogue_items(id,merchant,title,description,category,kind,city,state,source,slug,detail_url,starts_at,ends_at,schedule_verified_at,availability) values($1,'Audit','Event','Fixture','Events','event','adelaide','SA','https://example.test',$1,'/deals/'||$1,now()+interval '1 day',now()+interval '2 days',now(),'{"reviewState":"checked"}')`,[id]);
  await pool.query("update catalogue_items set starts_at=starts_at+interval '1 hour' where id=$1",[id]);const row=(await pool.query('select schedule_verified_at,availability from catalogue_items where id=$1',[id])).rows[0];assert.equal(row.schedule_verified_at,null);assert.equal(row.availability.reviewState,'unknown');
 });
 await check('new plan measurement events satisfy the database contract',async()=>{await pool.query("insert into engagement_events(event_type,metadata) values('plan_created','{\"traffic_type\":\"internal\"}')");});
 await pool.query(await readFile(new URL('../../supabase/migrations/20260925090710_consumer_device_continuity.sql',import.meta.url),'utf8'));
 await check('device pairing is atomic, single-use and keeps both private identities on the same consumer',async()=>{
  const hash=()=>randomUUID().replaceAll('-','')+randomUUID().replaceAll('-','');
  const original=hash(),newHash=hash(),token=hash(),cid=(await pool.query('select marketplace_identity($1) id',[original])).rows[0].id;
  await pool.query("insert into marketplace_device_links(token_hash,consumer_id,expires_at) values($1,$2,now()+interval '10 minutes')",[token,cid]);
  const results=await Promise.all([pool.query('select marketplace_connect_device($1,$2,$3) ok',[token,newHash,'Phone']),pool.query('select marketplace_connect_device($1,$2,$3) ok',[token,hash(),'Other'])]);
  assert.equal(results.filter(r=>r.rows[0].ok).length,1);
  assert.equal((await pool.query('select marketplace_identity($1) id',[original])).rows[0].id,cid);
  const paired=(await pool.query('select credential_hash from marketplace_devices where consumer_id=$1',[cid])).rows[0].credential_hash;
  assert.equal((await pool.query('select marketplace_identity($1) id',[paired])).rows[0].id,cid);
  await pool.query('update marketplace_devices set revoked_at=now() where credential_hash=$1',[paired]);await assert.rejects(pool.query('select marketplace_identity($1)',[paired]),/identity_required/);
  assert.equal((await pool.query("select has_function_privilege('anon','marketplace_connect_device(text,text,text)','EXECUTE') ok")).rows[0].ok,false);
 });

}
