import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';

export async function testMerchantPublication(pool,check){
  await pool.query(await readFile(new URL('../../supabase/migrations/20260925100500_merchant_listing_publication.sql',import.meta.url),'utf8'));
  const actor=randomUUID();await pool.query('insert into auth.users(id) values($1)',[actor]);
  const mid=(await pool.query("insert into merchants(name,slug,listing_status,primary_state,primary_city) values('Publication fixture',$1,'verified','SA','adelaide') returning id",[randomUUID()])).rows[0].id;
  await pool.query("insert into merchant_members(merchant_id,user_id,role) values($1,$2,'owner')",[mid,actor]);
  const offer=async(mode,capacity=null,action='redemption_code')=>(await pool.query(`insert into merchant_offers(merchant_id,title,description,conditions,location,city,state,fulfilment_mode,action_type,capacity_total,capacity_remaining,starts_at,ends_at,booking_url,discount_type)
    values($1,'Fixture listing','Isolated fixture','See the official event conditions.','Test location','adelaide','SA',$2,$3,$4,$4,now()+interval '1 day',now()+interval '2 days','https://example.test/event','custom') returning id`,[mid,mode,action,capacity])).rows[0].id;
  const publish=(id,user=actor)=>pool.query('select marketplace_publish($1,$2,$3) result',[user,mid,id]);
  await check('publication retains authority, capacity, official-link and provider gates',async()=>{
    const id=await offer('direct_claim');
    await assert.rejects(publish(id,randomUUID()),/merchant_access_denied/);
    await assert.rejects(publish(id),/capacity_and_schedule_required/);
    await assert.rejects(publish(await offer('external_booking',null,'booking_claim')),/provider_publication_requires_review/);
    for(const mode of ['external_booking','information_only']){
      const external=await offer(mode);
      await assert.rejects(publish(external),/authorised_image_required/);
      await pool.query('update merchant_offers set booking_url=null where id=$1',[external]);
      await assert.rejects(publish(external),/booking_url_required/);
    }
    assert.equal((await pool.query("select has_function_privilege('anon','marketplace_publish(uuid,uuid,uuid)','EXECUTE') ok")).rows[0].ok,false);
  });
  // Synthetic approved assets exist only in this throwaway database.
  const asset=randomUUID(),url=`https://example.test/merchant-media-approved/${asset}.jpg`;
  await pool.query(`insert into merchant_media_assets(id,merchant_id,asset_kind,staging_path,original_filename,content_type,byte_size,content_sha256,rights_basis,rights_statement,submitted_by)
    values($1,$2,'hero',$3,'fixture.jpg','image/jpeg',4,$4,'merchant_owned','Isolated test photograph',$5)`,[asset,mid,`${mid}/${asset}/fixture.jpg`,'c'.repeat(64),actor]);
  await pool.query(`update merchant_media_assets set status='approved',public_bucket='merchant-media-approved',public_path=$2,public_url=$3,reviewed_by=$4,reviewed_at=now(),review_reason='Fixture review',review_evidence='Isolated test evidence',public_projected_at=now() where id=$1`,[asset,`${asset}.jpg`,url,actor]);
  await check('external and informational listings publish without claim capacity and retain reviewed media',async()=>{
    for(const [mode,action] of [['external_booking','booking'],['information_only','ticket_link']]){
      const id=await offer(mode),published=(await publish(id)).rows[0].result;
      assert.equal(published.status,'active');assert.equal(published.capacity_total,null);assert.equal(published.action_type,action);
      const card=(await pool.query('select image_url,media_status,metadata from catalogue_items where id=$1',[published.published_drop_id])).rows[0];
      assert.equal(card.image_url,url);assert.equal(card.media_status,'approved');assert.equal(card.metadata.merchant_media_asset_id,asset);assert.equal(card.metadata.merchant_offer_id,id);
      await assert.rejects(pool.query('select claim_merchant_offer($1,null,$2,1,$3)',[id,randomUUID(),'PD-FIXTURE']),/direct_claim_not_allowed/);
    }
    const direct=(await publish(await offer('direct_claim',2))).rows[0].result;
    assert.equal(direct.capacity_remaining,2);assert.equal(direct.action_type,'redemption_code');
  });
}
