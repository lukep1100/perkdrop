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
}
