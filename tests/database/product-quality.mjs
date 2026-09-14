import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
export async function testProductQuality(pool,check) {
  await pool.query(await readFile(new URL('./product-quality-baseline.sql',import.meta.url),'utf8'));
  await pool.query(await readFile(new URL('../../supabase/migrations/20260914083459_product_quality_guards.sql',import.meta.url),'utf8'));
  const merchant=async()=> (await pool.query("insert into merchants(name,slug,primary_location,primary_state,listing_status,claimable) values('Isolated quality fixture',$1,$2,'SA','unclaimed',true) returning id",[randomUUID(),'Test '+randomUUID()])).rows[0].id;
  const contact=(m,email,status='research')=>pool.query("insert into outreach_contacts(merchant_id,email,source_url,status) values($1,$2,'https://example.invalid',$3) returning id,status",[m,email,status]);
  const message=(m,email,status='draft',metadata={})=>pool.query("insert into outreach_messages(merchant_id,email,consent_basis,subject,body_text,status,metadata) values($1,$2,'express','Isolated test','Never sent',$3,$4) returning *",[m,email,status,metadata]);
  await check('unapproved merchant hero image cannot be persisted',async()=>{
    const m=await merchant();
    await assert.rejects(
      pool.query("update merchants set hero_image_url='https://example.invalid/hero.png',image_rights_status='candidate' where id=$1",[m]),
      error=>/merchants_hero_image_rights_check/.test(String(error.message))
    );
    assert.equal((await pool.query('select hero_image_url from merchants where id=$1',[m])).rows[0].hero_image_url,null);
    await pool.query("update merchants set hero_image_url='https://example.invalid/hero.png',image_rights_status='licensed' where id=$1",[m]);
    assert.equal((await pool.query('select hero_image_url from merchants where id=$1',[m])).rows[0].hero_image_url,'https://example.invalid/hero.png');
  });
  await check('suppressed email cannot be re-imported with case/space differences',async()=>{
    const m=await merchant(),email=randomUUID()+'@example.invalid';
    await pool.query("insert into outreach_suppression(email,reason) values($1,'unsubscribe')",[email]);
    assert.equal((await contact(m,' '+email.toUpperCase()+' ')).rows[0].status,'suppressed');
    assert.equal((await message(m,email,'approved')).rows[0].status,'suppressed');
    await assert.rejects(message(m,email,'sent'),/outreach_suppressed/);
  });
  await check('suppression propagates to existing contacts and approved messages',async()=>{
    const m=await merchant(),email=randomUUID()+'@example.invalid';await contact(m,email);await message(m,email,'approved');
    await pool.query("insert into outreach_suppression(email,reason) values($1,'unsubscribe')",[email]);
    assert.equal((await pool.query('select status from outreach_contacts where email=$1',[email])).rows[0].status,'suppressed');
    assert.equal((await pool.query('select status from outreach_messages where email=$1',[email])).rows[0].status,'suppressed');
  });
  await check('invalid contacts create durable suppression without recursive updates',async()=>{
    const m=await merchant(),email=randomUUID()+'@example.invalid';await contact(m,email);
    await pool.query("update outreach_contacts set status='invalid' where email=$1",[email]);
    assert.equal((await pool.query('select count(*) from outreach_suppression where email=$1',[email])).rows[0].count,'1');
    assert.equal((await pool.query("update outreach_contacts set status='research' where email=$1 returning status",[email])).rows[0].status,'suppressed');
  });
  await check('hard bounce is permanent; transient failure is not invented as permanent',async()=>{
    const m=await merchant(),hard=randomUUID()+'@example.invalid',soft=randomUUID()+'@example.invalid';
    await message(m,hard,'bounced',{bounce_type:'hard'});await message(m,soft,'failed',{bounce_type:'temporary'});
    assert.equal((await pool.query('select outreach_is_suppressed($1,$2) blocked',[hard,m])).rows[0].blocked,true);
    assert.equal((await pool.query('select outreach_is_suppressed($1,$2) blocked',[soft,m])).rows[0].blocked,false);
  });
  await check('historical migration baseline: unsubscribe was suppression-only before owner policy',async()=>{
    const m=await merchant(),email=randomUUID()+'@example.invalid';await contact(m,email);const msg=(await message(m,email,'sent')).rows[0];
    for(let i=0;i<2;i++)assert.equal((await pool.query('select unsubscribe_outreach($1) done',[msg.unsubscribe_token])).rows[0].done,true);
    const business=(await pool.query('select do_not_contact,permanent_listing,directory_status from merchants where id=$1',[m])).rows[0];
    assert.deepEqual(business,{do_not_contact:true,permanent_listing:true,directory_status:'active'});
    assert.equal((await pool.query('select unsubscribe_outreach($1) done',[randomUUID()])).rows[0].done,false);
  });
  await check('explicit removal persists through same-id and changed-slug re-import',async()=>{
    const m=await merchant();await pool.query("select record_directory_removal($1,'Explicit test removal','synthetic-test-reference')",[m]);
    assert.equal((await pool.query("update merchants set directory_status='active',permanent_listing=true where id=$1 returning permanent_listing",[m])).rows[0].permanent_listing,false);
    const original=(await pool.query('select name,primary_location from merchants where id=$1',[m])).rows[0];
    const copy=(await pool.query("insert into merchants(name,slug,primary_location) values($1,$2,$3) returning permanent_listing",[original.name,randomUUID(),original.primary_location])).rows[0];assert.equal(copy.permanent_listing,false);
  });
  const user=async(verified=true)=>{const id=randomUUID();await pool.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id,id+'@example.invalid',verified?new Date():null]);return id;};
  const payload={contact_name:'Synthetic tester',business_role:'Manager',terms_accepted:true,privacy_acknowledged:true};
  const claim=(m,u,p=payload)=>pool.query('select submit_business_claim($1,$2,$3) result',[m,u,p]);
  await check('12 concurrent claim retries create one pending business claim',async()=>{
    const m=await merchant(),u=await user();const results=await Promise.all(Array.from({length:12},()=>claim(m,u)));
    assert.equal(new Set(results.map(x=>x.rows[0].result.id)).size,1);assert.equal(results.filter(x=>x.rows[0].result.created).length,1);
    assert.equal((await pool.query('select listing_status from merchants where id=$1',[m])).rows[0].listing_status,'claim_pending');
    await assert.rejects(claim(m,await user()),/listing_not_claimable/);
  });
  await check('claim verification, role, consent and removed business gates fail closed',async()=>{
    const m=await merchant(),u=await user();await assert.rejects(claim(m,await user(false)),/verified_email_required/);
    await assert.rejects(claim(m,u,{...payload,business_role:''}),/missing_required_fields/);
    await assert.rejects(claim(m,u,{...payload,terms_accepted:false}),/merchant_terms_and_privacy_required/);
    await pool.query("select record_directory_removal($1,'Explicit test removal','synthetic-test-reference')",[m]);await assert.rejects(claim(m,u),/merchant_not_found/);
  });
  await check('new privileged RPCs and removal ledger deny public/authenticated access',async()=>{
    const client=await pool.connect();try{for(const role of ['anon','authenticated']){await client.query('set role '+role);await assert.rejects(client.query('select unsubscribe_outreach($1)',[randomUUID()]),/permission denied/);await assert.rejects(client.query('select submit_business_claim($1,$2,$3)',[randomUUID(),randomUUID(),payload]),/permission denied/);await assert.rejects(client.query('select * from directory_exclusions'),/permission denied/);await client.query('reset role');}}finally{await client.query('reset role');client.release();}
  });
  await check('business invites require the verified invited email and accept once under concurrency',async()=>{
    const m=await merchant(),u=await user(),wrong=await user(),hash=randomUUID();
    await pool.query("insert into merchant_invites(merchant_id,email,role,token_hash,created_by,expires_at) values($1,$2,'floor',$3,$4,now()+interval '1 day')",[m,u+'@example.invalid',hash,u]);
    await assert.rejects(pool.query('select accept_business_invite($1,$2)',[hash,wrong]),/invite_email_mismatch/);
    const results=await Promise.allSettled(Array.from({length:12},()=>pool.query('select accept_business_invite($1,$2)',[hash,u])));
    assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
    assert.equal((await pool.query('select count(*) from merchant_members where merchant_id=$1 and user_id=$2',[m,u])).rows[0].count,'1');
  });
  await check('invite cannot overwrite an existing owner membership',async()=>{
    const m=await merchant(),u=await user(),hash=randomUUID();await pool.query("insert into merchant_members(merchant_id,user_id,role) values($1,$2,'owner')",[m,u]);
    await pool.query("insert into merchant_invites(merchant_id,email,role,token_hash,created_by,expires_at) values($1,$2,'floor',$3,$4,now()+interval '1 day')",[m,u+'@example.invalid',hash,u]);
    await assert.rejects(pool.query('select accept_business_invite($1,$2)',[hash,u]),/membership_already_exists/);
    assert.equal((await pool.query('select role from merchant_members where merchant_id=$1 and user_id=$2',[m,u])).rows[0].role,'owner');
  });
}
