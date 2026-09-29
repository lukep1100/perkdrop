import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
export async function runMobileReleaseChecks(pool,check) {
  await pool.query(await readFile(new URL('../../supabase/release/mobile-release.sql',import.meta.url),'utf8'));
  const a=randomBytes(32).toString('hex'),b=randomBytes(32).toString('hex');
  const token='ExponentPushToken['+randomBytes(16).toString('hex')+']';
  const prefs={city:'adelaide',timezone:'Australia/Adelaide'};
  let ca,cb;
  await check('native push registration is bound to an authenticated device',async()=>{
    await pool.query('select mobile_register_push($1,$2,$3,$4)',[a,token,'ios',prefs]);
    ca=(await pool.query('select id from marketplace_consumers where credential_hash=$1',[a])).rows[0].id;
    cb=(await pool.query('select marketplace_identity($1) as id',[b])).rows[0].id;
    const row=(await pool.query('select * from mobile_push_subscriptions where device_hash=$1',[a])).rows[0];
    assert.equal(row.consumer_id,ca);assert.equal(row.preferences.frequency,'weekly');assert.equal(row.preferences.quiet_start,20);
  });
  await check('a second device cannot take an existing push token',async()=>{
    await assert.rejects(pool.query('select mobile_register_push($1,$2,$3,$4)',[b,token,'android',prefs]),/unique|duplicate/);
    assert.equal((await pool.query('select consumer_id from mobile_push_subscriptions where expo_token=$1',[token])).rows[0].consumer_id,ca);
  });
  await check('invalid push city and credentials are rejected',async()=>{
    await assert.rejects(pool.query('select mobile_register_push($1,$2,$3,$4)',['bad',token,'ios',prefs]),/invalid_push_registration/);
    await assert.rejects(pool.query('select mobile_register_push($1,$2,$3,$4)',[b,'ExpoPushToken[abcdefghijklmnop]','ios',{city:'fake',timezone:'Australia/Adelaide'}]),/invalid_push_city/);
  });
  await check('atomic push claim enforces opt-out and one weekly reservation',async()=>{
    const item=(await pool.query('select id from catalogue_items limit 1')).rows[0]?.id;
    assert.ok(item,'Baseline catalogue fixture must be present');
    const sub=(await pool.query('select id from mobile_push_subscriptions where device_hash=$1',[a])).rows[0].id;
    const zone=(await pool.query("select name from pg_timezone_names where extract(hour from now() at time zone name) between 10 and 16 limit 1")).rows[0].name;
    await pool.query("update mobile_push_subscriptions set preferences=jsonb_set(preferences,'{timezone}',to_jsonb($2::text)),last_sent_at=null where id=$1",[sub,zone]);
    const ids=[];
    for(let i=0;i<2;i++)ids.push((await pool.query("insert into mobile_push_deliveries(subscription_id,catalogue_item_id,campaign_key,expires_at) values($1,$2,$3,now()+interval '1 hour') returning id",[sub,item,'test-'+i])).rows[0].id);
    const results=await Promise.all([ids[0],ids[0],ids[1]].map(id=>pool.query('select mobile_claim_push($1) as result',[id])));
    assert.equal(results.filter(r=>r.rows[0].result).length,1);
    await pool.query('update mobile_push_subscriptions set enabled=false,last_sent_at=null where id=$1',[sub]);
    for(const id of ids)assert.equal((await pool.query('select mobile_claim_push($1) as result',[id])).rows[0].result,null);
  });
  await check('public roles cannot read notification tokens or call destructive RPCs',async()=>{
    const result=(await pool.query("select has_table_privilege('anon','mobile_push_subscriptions','SELECT') as token_read,has_function_privilege('anon','mobile_delete_consumer(text)','EXECUTE') as can_delete,has_function_privilege('authenticated','mobile_register_push(text,text,text,jsonb)','EXECUTE') as can_register")).rows[0];
    assert.equal(result.token_read,false);assert.equal(result.can_delete,false);assert.equal(result.can_register,false);
  });
  await check('deleting one device account removes its push data but not another account',async()=>{
    const result=(await pool.query('select mobile_delete_consumer($1) as result',[a])).rows[0].result;
    assert.equal(result.deleted,true);
    assert.equal((await pool.query('select count(*)::int as n from mobile_push_subscriptions where device_hash=$1',[a])).rows[0].n,0);
    assert.equal((await pool.query('select count(*)::int as n from marketplace_consumers where id=$1',[ca])).rows[0].n,0);
    assert.equal((await pool.query('select count(*)::int as n from marketplace_consumers where id=$1',[cb])).rows[0].n,1);
  });
}
