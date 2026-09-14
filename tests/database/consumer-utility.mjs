import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function testConsumerUtility(pool,check){
 await pool.query(await readFile(new URL('../../supabase/migrations/20260914093556_consumer_utility.sql',import.meta.url),'utf8'));
 const mid=(await pool.query("insert into merchants(name,slug,permanent_listing,directory_status) values('Isolated report fixture',$1,true,'active') returning id",[randomUUID()])).rows[0].id;
 const hash=()=>randomBytes(32).toString('hex');
 const submit=(h,reason='times',detail='',merchant=mid)=>pool.query('select submit_listing_report(null,$1,$2,$3,$4) id',[merchant,reason,detail,h]);
 await check('consumer report is private, durable and never removes a business',async()=>{
  const id=(await submit(hash())).rows[0].id;assert.ok(id);assert.equal((await pool.query('select status from listing_reports where id=$1',[id])).rows[0].status,'pending');assert.equal((await pool.query('select directory_status from merchants where id=$1',[mid])).rows[0].directory_status,'active');
  assert.equal((await pool.query("select has_table_privilege('anon','listing_reports','SELECT') ok")).rows[0].ok,false);
  assert.equal((await pool.query("select has_function_privilege('anon','submit_listing_report(text,uuid,text,text,text)','EXECUTE') ok")).rows[0].ok,false);
 });
 await check('concurrent repeated reports deduplicate atomically',async()=>{
  const h=hash(),results=await Promise.all(Array.from({length:12},()=>submit(h)));assert.equal(new Set(results.map(x=>x.rows[0].id)).size,1);
 });
 await check('report rate limit and input validation are enforced in database',async()=>{
  const h=hash();for(const r of ['times','price','closed','location','unavailable'])await submit(h,r);
  await assert.rejects(submit(h,'other'),/report_rate_limit/);await assert.rejects(submit(hash(),'invented'),/invalid_report/);await assert.rejects(submit(hash(),'other','x'.repeat(1001)),/invalid_report/);await assert.rejects(submit('bad'),/invalid_reporter/);
 });
 await check('reports reject nonexistent and directory-excluded targets',async()=>{
  await assert.rejects(submit(hash(),'times','',randomUUID()),/listing_not_found/);
  await pool.query("update merchants set directory_status='removed' where id=$1",[mid]);await assert.rejects(submit(hash()),/listing_not_found/);
 });
}
