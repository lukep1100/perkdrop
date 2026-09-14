import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function testOwnerPolicy(pool,check){
  // Minimal exported outbox shape; no dispatcher or external transport exists in this cluster.
  await pool.query("create table if not exists merchant_notification_outbox(id uuid primary key default gen_random_uuid(),merchant_id uuid,event_type text not null,recipient_email text not null,payload jsonb not null default '{}',status text not null default 'pending')");
  await pool.query(await readFile(new URL('../../supabase/migrations/20260914110110_owner_publication_policy.sql',import.meta.url),'utf8'));
  const merchant=async(name='Policy fixture',location=randomUUID())=>(await pool.query("insert into merchants(name,slug,primary_location,primary_state,website_url) values($1,$2,$3,'SA','https://example.invalid/branch') returning id",[name,randomUUID(),location])).rows[0].id;
  const request=(mid,kind='business_optout',extra={})=>pool.query('select record_business_request($1)',[{merchant_id:mid,business_name:'Policy fixture',request_kind:kind,match_state:'confirmed',original_request:'Stop emailing us',request_reference:randomUUID(),match_basis:'Synthetic exact-branch evidence',recipient:randomUUID()+'@example.invalid',...extra}]);
  await check('confirmed opt-out delists under policy without rewriting the original request',async()=>{
    const mid=await merchant();await request(mid);
    assert.deepEqual((await pool.query('select permanent_listing,directory_status,do_not_contact from merchants where id=$1',[mid])).rows[0],{permanent_listing:false,directory_status:'removed',do_not_contact:true});
    const r=(await pool.query('select original_request,policy_basis from business_requests where merchant_id=$1',[mid])).rows[0];assert.equal(r.original_request,'Stop emailing us');assert.equal(r.policy_basis,'owner_publication_policy');
  });
  await check('temporary failure blocks recipient and alternate address but does not delist',async()=>{
    const mid=await merchant();await request(mid,'delivery_failure',{failure_class:'temporary',original_request:'Temporary delivery failure'});
    assert.equal((await pool.query("select outreach_is_suppressed('alternate@example.invalid',$1) blocked",[mid])).rows[0].blocked,true);
    assert.equal((await pool.query('select permanent_listing from merchants where id=$1',[mid])).rows[0].permanent_listing,true);
    assert.equal((await pool.query('select reason from outreach_suppression where merchant_id=$1',[mid])).rows[0].reason,'manual');
  });
  await check('ambiguous inbound message cannot remove a guessed business',async()=>{
    const mid=await merchant();await request(mid,'ambiguous',{match_state:'ambiguous',original_request:'Not interested in this offer'});
    assert.equal((await pool.query('select permanent_listing from merchants where id=$1',[mid])).rows[0].permanent_listing,true);
    assert.equal((await pool.query('select count(*) from directory_exclusions where merchant_id=$1',[mid])).rows[0].count,'0');
  });
  await check('excluded exact identity blocks later import, not another branch or shared domain',async()=>{
    const name='Named test branch '+randomUUID(),location='Specific test address';await request(null,'business_optout',{business_name:name,branch_location:location,official_url:'https://example.invalid/this-branch'});
    const blocked=await merchant(name,location),other=await merchant(name,'Different branch address');
    assert.equal((await pool.query('select permanent_listing from merchants where id=$1',[blocked])).rows[0].permanent_listing,false);
    assert.equal((await pool.query('select permanent_listing from merchants where id=$1',[other])).rows[0].permanent_listing,true);
  });
  await check('new and reactivated catalogue/merchant offers remain private after exclusion',async()=>{
    const mid=await merchant(),id=randomUUID();await request(mid);
    await pool.query("insert into catalogue_items(id,merchant_id,merchant,title,description,category,kind,city,source,slug,detail_url,active) values($1,$2,'Fixture','Test only','Isolated fixture','Food & Drink','Deal','adelaide','https://example.invalid',$1,'https://example.invalid',true)",[id,mid]);
    assert.equal((await pool.query('update catalogue_items set active=true where id=$1 returning active',[id])).rows[0].active,false);
    const o=(await pool.query("insert into merchant_offers(merchant_id,title,description,status,visibility) values($1,'Test','Isolated fixture','active','public') returning id,visibility",[mid])).rows[0];assert.equal(o.visibility,'private');
    assert.equal((await pool.query("update merchant_offers set visibility='public' where id=$1 returning visibility",[o.id])).rows[0].visibility,'private');
  });
  await check('business opt-out blocks approved queue and sent-state bypass',async()=>{
    const mid=await merchant();await pool.query("insert into outreach_messages(merchant_id,email,consent_basis,subject,body_text,status) values($1,'next@example.invalid','express','Test','Never sent','approved')",[mid]);await request(mid);
    assert.equal((await pool.query('select status from outreach_messages where merchant_id=$1',[mid])).rows[0].status,'suppressed');
    await assert.rejects(pool.query("update outreach_messages set status='sent' where merchant_id=$1",[mid]),/outreach_suppressed/);
  });
  await check('unsubscribe form RPC is idempotent and now soft-delists',async()=>{
    const mid=await merchant();const token=(await pool.query("insert into outreach_messages(merchant_id,email,consent_basis,subject,body_text,status) values($1,$2,'express','Test','Never sent','draft') returning unsubscribe_token",[mid,randomUUID()+'@example.invalid'])).rows[0].unsubscribe_token;
    await pool.query('select unsubscribe_outreach($1)',[token]);await pool.query('select unsubscribe_outreach($1)',[token]);
    assert.equal((await pool.query('select count(*) from business_requests where merchant_id=$1',[mid])).rows[0].count,'1');assert.equal((await pool.query('select permanent_listing from merchants where id=$1',[mid])).rows[0].permanent_listing,false);
  });
  await check('review requires evidence and policy ledger denies public/authenticated access',async()=>{
    const mid=await merchant();await request(mid,'ambiguous',{match_state:'ambiguous'});
    await assert.rejects(pool.query("update business_requests set status='resolved' where merchant_id=$1",[mid]),/check constraint/);
    const client=await pool.connect();try{for(const role of ['anon','authenticated']){await client.query('set role '+role);await assert.rejects(client.query('select * from business_requests'),/permission denied/);await assert.rejects(client.query("select record_business_request('{}')"),/permission denied/);await client.query('reset role');}}finally{await client.query('reset role');client.release();}
  });
  await check('verified email is not ownership; only evidence-reviewed admin approval creates access',async()=>{
    const mid=await merchant(), uid=randomUUID(), admin=randomUUID();
    await pool.query("insert into auth.users(id,email,email_confirmed_at) values($1,$2,now()),($3,'perkdropofficial@gmail.com',now())",[uid,uid+'@example.invalid',admin]);
    const args=[mid,uid,uid+'@example.invalid'];
    await assert.rejects(pool.query("insert into merchant_claims(merchant_id,user_id,contact_name,contact_email,evidence_notes) values($1,$2,'QA',$3,'URL only')",args),/authority_evidence_required/);
    const cid=(await pool.query("insert into merchant_claims(merchant_id,user_id,contact_name,contact_email,evidence_notes) values($1,$2,'QA',$3,'Isolated authorised representative fixture') returning id",args)).rows[0].id;
    assert.equal((await pool.query('select count(*) from merchant_members where merchant_id=$1',[mid])).rows[0].count,'0');
    await assert.rejects(pool.query("select approve_business_claim($1,$2,'Checked','Isolated evidence')",[cid,uid]),/admin_required/);
    await assert.rejects(pool.query("select approve_business_claim($1,$2,'','')",[cid,admin]),/review_evidence_required/);
    const rs=await Promise.allSettled(Array.from({length:4},()=>pool.query("select approve_business_claim($1,$2,'Authority reviewed','Isolated fixture evidence') result",[cid,admin])));
    assert.equal(rs.filter(r=>r.status==='fulfilled').length,1,rs.filter(r=>r.status==='rejected').map(r=>r.reason.message).join('; '));
    assert.equal(rs.find(r=>r.status==='fulfilled').value.rows[0].result.notification,'queued_not_delivered');
    assert.equal((await pool.query('select count(*) from merchant_members where merchant_id=$1',[mid])).rows[0].count,'1');
    assert.equal((await pool.query('select count(*) from merchant_notification_outbox where merchant_id=$1',[mid])).rows[0].count,'1');
    const excluded=await merchant();
    const blocked=(await pool.query("insert into merchant_claims(merchant_id,user_id,contact_name,contact_email,evidence_notes) values($1,$2,'QA',$3,'Isolated authorised representative fixture') returning id",[excluded,uid,uid+'@example.invalid'])).rows[0].id;
    await request(excluded);
    await assert.rejects(pool.query("select approve_business_claim($1,$2,'Checked','Isolated evidence')",[blocked,admin]),/business_excluded/);
  });
  await check('unlinked same-branch catalogue import cannot bypass policy exclusion',async()=>{
    const name='Unlinked excluded '+randomUUID(),location='Exact independent branch address';
    await request(null,'business_optout',{business_name:name,branch_location:location});
    const id=randomUUID();
    const row=(await pool.query("insert into catalogue_items(id,merchant,title,description,category,kind,city,source,slug,detail_url,active,location) values($1,$2,'Test only','Isolated fixture','Food & Drink','Deal','adelaide','https://example.invalid',$1,'https://example.invalid',true,$3) returning active",[id,name,location])).rows[0];
    assert.equal(row.active,false);
  });
}
