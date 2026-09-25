import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import {resolveSavedListings} from '../_shared/saved-listings.mjs';
import {dealPath} from '../_shared/deal-path.mjs';
const VERTICALS=['food','drinks','events','beauty','wellness','hair','experiences','activities','fitness','golf','tourism','stay','shopping','free','services','other'];
const MARKETS=['adelaide','sydney','melbourne','brisbane','perth','darwin','canberra','hobart','gold-coast'];
const PLAN_ITEM_LIMIT=12;

const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type, authorization, x-perkdrop-identity','Access-Control-Allow-Methods':'POST, OPTIONS','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'};
const reply=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers});
const validToken=(s:unknown):s is string=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s);
const hash=async(s:string)=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))).map(b=>b.toString(16).padStart(2,'0')).join('');
const secret=()=>Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b=>b.toString(16).padStart(2,'0')).join('');
const clean=(s:unknown,n=200)=>String(s??'').trim().slice(0,n);
const publicPass=(r:any,m:any,o:any)=>({reference:r.pass_reference,code:r.redemption_code,title:r.metadata?.offer_title||o?.title,merchant:m?.name,merchant_id:r.merchant_id,quantity:r.party_size,unit:r.metadata?.inventory_unit||o?.inventory_unit||'person',state:r.status==='created'?(r.expires_at&&new Date(r.expires_at)<=new Date()?'expired':'active'):r.status,expires_at:r.expires_at,redeemed_at:r.redeemed_at,service_start:r.metadata?.valid_from,service_end:r.metadata?.valid_until,timezone:r.metadata?.timezone||'Australia/Adelaide',booking_reference:r.metadata?.booking_reference||r.merchant_reference,terms:r.metadata?.terms||o?.conditions,location:o?.location||m?.primary_location});
const unique=(value:unknown,n=20)=>Array.isArray(value)?[...new Set(value.map(x=>clean(x,100)).filter(Boolean))].slice(0,n):[];
const validDate=(value:unknown)=>{const date=clean(value,10);return !date||/^\d{4}-\d{2}-\d{2}$/.test(date)?date:null;};
function preferences(input:any={}){
  const city=clean(input.city,80).toLowerCase();
  const verticals=unique(input.verticals).filter(x=>VERTICALS.includes(x));
  const radius=Number(input.radius_km);
  const intent=['any','tonight','weekend'].includes(clean(input.intent,20))?clean(input.intent,20):'any';
  return {city:MARKETS.includes(city)?city:'',verticals,radius_km:Number.isFinite(radius)&&radius>=1&&radius<=100?radius:null,intent};
}
const planHref=(item:any)=>dealPath(item?.slug);

Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(req.method!=='POST')return reply({error:'method_not_allowed'},405);
  if(Number(req.headers.get('content-length')||0)>16384)return reply({error:'body_too_large'},413);
  try{
    const raw=await req.text();if(raw.length>16384)return reply({error:'body_too_large'},413);
    const body=JSON.parse(raw),action=clean(body.action,50);
    const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
    async function rpc(name:string,args:any){const {data,error}=await db.rpc(name,args);if(error)throw new Error(error.message);return data}
    async function rows(query:any){const {data,error}=await query;if(error)throw new Error('storage_operation_failed');return data}
    async function count(query:any){const {count,error}=await query;if(error)throw new Error('storage_operation_failed');return Number(count)||0}
    async function publicCatalogueItems(itemIds:string[]){
      if(!itemIds.length)return [];
      const items=await rpc('marketplace_public_catalogue_items',{p_ids:itemIds});
      return Array.isArray(items)?items:[];
    }
    async function plansWithItems(plans:any[]){
      if(!plans.length)return [];
      const ids=plans.map(plan=>plan.id);
      const links=await rows(db.from('marketplace_plan_items').select('plan_id,catalogue_item_id,position').in('plan_id',ids).order('position',{ascending:true}));
      const itemIds=[...new Set((links||[]).map((item:any)=>item.catalogue_item_id))];
      const items=await publicCatalogueItems(itemIds);
      const itemMap=new Map((items||[]).map((item:any)=>[item.id,item]));
      return plans.map(plan=>({...plan,items:(links||[]).filter((link:any)=>link.plan_id===plan.id).map((link:any)=>{
        const item=itemMap.get(link.catalogue_item_id);
        return item?{id:item.id,merchant:item.merchant,title:item.title,location:item.location,timing:item.timing,href:planHref(item),available:true}:{id:link.catalogue_item_id,merchant:'',title:'Listing unavailable',location:'',timing:'',href:null,available:false};
      })}));
    }
    const incoming=req.headers.get('x-perkdrop-identity')||'';
    // Gateway-provided address is used only for abuse throttling, never authorization.
    const address=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'unknown';
    if(!await rpc('marketplace_rate_limit',{p_bucket:'api:'+await hash(address),p_max:180,p_seconds:60}))return reply({error:'rate_limited'},429);
    if(action==='pass'){
      if(!validToken(body.reference))return reply({error:'pass_not_found'},404);
      const r=await rows(db.from('redemptions').select('*').eq('pass_reference',body.reference).maybeSingle());
      if(!r)return reply({error:'pass_not_found'},404);
      if(r.status==='pending')await rpc('marketplace_expire_pending',{p_offer:r.merchant_offer_id});
      const [current,m,o]=await Promise.all([rows(db.from('redemptions').select('*').eq('id',r.id).single()),rows(db.from('merchants').select('name,primary_location').eq('id',r.merchant_id).single()),rows(db.from('merchant_offers').select('title,conditions,inventory_unit,location').eq('id',r.merchant_offer_id).maybeSingle())]);
      return reply({pass:publicPass(current,m,o)});
    }
    if(action==='recover'){
      if(!validToken(body.token)||!validToken(body.new_credential))return reply({error:'invalid_recovery'},400);
      const ok=await rpc('marketplace_recover',{p_token_hash:await hash(body.token),p_new_hash:await hash(body.new_credential)});
      return reply(ok?{ok:true}:{error:'invalid_or_expired_recovery'},ok?200:400);
    }
    if(action==='device_connect'){
      if(!validToken(body.token)||!validToken(body.new_credential))return reply({error:'invalid_device_link'},400);
      const ok=await rpc('marketplace_connect_device',{p_token_hash:await hash(body.token),p_new_hash:await hash(body.new_credential),p_label:clean(body.label,80)});
      return reply(ok?{ok:true}:{error:'invalid_or_expired_device_link'},ok?200:400);
    }
    if(action==='recovery_email'){
      const email=clean(body.email,254).toLowerCase();
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply({error:'invalid_email'},400);
      // There is no verified consumer email transport in this release. Do not
      // queue a secret or imply that a recovery message will be sent.
      await rpc('marketplace_rate_limit',{p_bucket:'recovery:'+await hash(email),p_max:3,p_seconds:3600});
      return reply({ok:true,delivery:'not_available'});
    }
    if(action==='plan_public'){
      if(!validToken(body.token))return reply({error:'plan_not_found'},404);
      const tokenHash=await hash(body.token);
      if(!await rpc('marketplace_rate_limit',{p_bucket:'plan-view:'+tokenHash,p_max:60,p_seconds:60}))return reply({error:'rate_limited'},429);
      const plan=await rows(db.from('marketplace_plans').select('id,name,planned_for,note,group_details,created_at,updated_at').eq('share_token_hash',tokenHash).is('share_revoked_at',null).maybeSingle());
      if(!plan)return reply({error:'plan_not_found'},404);
      const [publicPlan]=await plansWithItems([plan]);
      return reply({plan:publicPlan});
    }
    if(!validToken(incoming))return reply({error:'identity_required'},401);
    const credentialHash=await hash(incoming),cid=await rpc('marketplace_identity',{p_hash:credentialHash});
    if(action==='device_link'){
      if(!await rpc('marketplace_rate_limit',{p_bucket:'device-link:'+cid,p_max:5,p_seconds:3600}))return reply({error:'rate_limited'},429);
      const token=secret(),expires=new Date(Date.now()+10*60000).toISOString();
      await rows(db.from('marketplace_device_links').insert({consumer_id:cid,token_hash:await hash(token),expires_at:expires}));
      return reply({url:'https://perkdrop.au/connect-device#'+token,app_url:'perkdrop://connect#'+token,expires_at:expires});
    }
    if(action==='devices'){
      const devices=await rows(db.from('marketplace_devices').select('credential_hash,label,created_at,revoked_at').eq('consumer_id',cid));
      return reply({devices:devices.map((d:any)=>({id:d.credential_hash,label:d.label,created_at:d.created_at,revoked_at:d.revoked_at,current:d.credential_hash===credentialHash}))});
    }
    if(action==='device_revoke'){
      if(!validToken(body.id))return reply({error:'invalid_device'},400);
      await rows(db.from('marketplace_devices').update({revoked_at:new Date().toISOString()}).eq('consumer_id',cid).eq('credential_hash',body.id));
      return reply({ok:true});
    }
    if(action==='claim')return reply(await rpc('marketplace_claim',{p_hash:credentialHash,p_offer:body.offer_id,p_quantity:Number(body.quantity)}));
    if(action==='preferences'){
      const profile=await rows(db.from('marketplace_consumers').select('preferences').eq('id',cid).single());
      return reply({preferences:preferences(profile?.preferences)});
    }
    if(action==='preferences_save'){
      const next=preferences(body.preferences||{});
      await rows(db.from('marketplace_consumers').update({preferences:next}).eq('id',cid));
      return reply({ok:true,preferences:next});
    }
    if(action==='watches')return reply({watches:await rows(db.from('marketplace_watches').select('id,name,active,rule').eq('consumer_id',cid).order('created_at',{ascending:false}))});
    if(action==='watch_save'){
      const input=body.rule||{},name=clean(body.name,120);
      const validList=(value:any,allowed:string[])=>Array.isArray(value)?value.filter(x=>allowed.includes(x)).slice(0,20):[];
      const rule:any={city:clean(input.city,80).toLowerCase(),precinct:clean(input.precinct,80).toLowerCase(),verticals:validList(input.verticals,VERTICALS),drop_types:validList(input.drop_types,['capacity','cancellation','last_minute','exclusive']),times:validList(input.times,['morning','lunch','afternoon','evening','weekend']),daily_cap:Math.min(10,Math.max(1,Number(input.daily_cap)||3)),quiet_start:Math.min(23,Math.max(0,Number(input.quiet_start)||22)),quiet_end:Math.min(23,Math.max(0,Number(input.quiet_end)||7)),timezone:clean(input.timezone,80)||'Australia/Adelaide'};
      try{new Intl.DateTimeFormat('en-AU',{timeZone:rule.timezone});}catch{return reply({error:'invalid_timezone'},400);}
      if(input.merchant_id){const merchant=await rows(db.from('merchants').select('id').eq('id',input.merchant_id).maybeSingle());if(!merchant)return reply({error:'merchant_not_found'},404);rule.merchant_id=merchant.id;}
      if(input.radius_km){const radius=Number(input.radius_km),lat=Number(input.latitude),lng=Number(input.longitude);if(!Number.isFinite(radius)||radius<1||radius>100||!Number.isFinite(lat)||lat< -90||lat>90||!Number.isFinite(lng)||lng< -180||lng>180)return reply({error:'invalid_location'},400);Object.assign(rule,{radius_km:radius,latitude:lat,longitude:lng});}
      if(!name||!rule.city)return reply({error:'name_and_city_required'},400);
      if(body.id)await rows(db.from('marketplace_watches').update({name,rule,active:body.active!==false,updated_at:new Date().toISOString()}).eq('id',body.id).eq('consumer_id',cid));
      else{const existing=await rows(db.from('marketplace_watches').select('id').eq('consumer_id',cid));if(existing.length>=30)return reply({error:'watch_limit_reached'},409);await rows(db.from('marketplace_watches').insert({consumer_id:cid,name,rule}));}
      return reply({ok:true});
    }
    if(action==='watch_delete'){await rows(db.from('marketplace_watches').delete().eq('consumer_id',cid).eq('id',body.id));return reply({ok:true});}
    if(action==='standby'){
      const city=clean(body.city,80).toLowerCase(),vertical=clean(body.vertical,30),window=clean(body.time_window,80),quantity=Number(body.quantity),radius=Number(body.radius_km),expires=new Date(body.expires_at);
      if(!city||!VERTICALS.includes(vertical)||!window||!Number.isInteger(quantity)||quantity<1||quantity>20||!Number.isFinite(radius)||radius<1||radius>100||!Number.isFinite(expires.getTime())||expires.getTime()<=Date.now()||expires.getTime()>Date.now()+7*86400000)return reply({error:'invalid_demand'},400);
      const budget=body.budget===''||body.budget==null?null:Number(body.budget);if(budget!==null&&(!Number.isFinite(budget)||budget<0||budget>10000))return reply({error:'invalid_budget'},400);
      await rpc('marketplace_standby',{p_consumer:cid,p_city:city,p_vertical:vertical,p_window:window,p_precinct:clean(body.precinct,80).toLowerCase(),p_quantity:quantity,p_radius:radius,p_budget:budget,p_expires:expires.toISOString()});
      return reply({ok:true});
    }
    if(action==='my_perks'){
      const pending=await rows(db.from('redemptions').select('merchant_offer_id').eq('consumer_id',cid).eq('status','pending'));
      for(const id of new Set((pending||[]).map((r:any)=>r.merchant_offer_id)))await rpc('marketplace_expire_pending',{p_offer:id});
      const [redemptions,saves,profile,updatesUnread]=await Promise.all([
        rows(db.from('redemptions').select('id,pass_reference,status,party_size,expires_at,created_at,metadata,merchant_id,merchant_offer_id').eq('consumer_id',cid).order('created_at',{ascending:false}).limit(200)),
        rows(db.from('marketplace_saves').select('kind,target,created_at').eq('consumer_id',cid)),
        rows(db.from('marketplace_consumers').select('preferences,email,email_verified_at').eq('id',cid).single()),
        count(db.from('marketplace_consumer_updates').select('id',{count:'exact',head:true}).eq('consumer_id',cid).is('read_at',null))
      ]);
      const dropIds=saves.filter((s:any)=>s.kind==='drop').map((s:any)=>s.target);
      const merchantIds=saves.filter((s:any)=>s.kind==='merchant').map((s:any)=>s.target);
      const [savedDrops,savedMerchants]=await Promise.all([
        publicCatalogueItems(dropIds),
        merchantIds.length?rows(db.from('merchants').select('id,name,slug,permanent_listing,directory_status').in('id',merchantIds)):[]
      ]);
      return reply({redemptions,saves:resolveSavedListings(saves,savedDrops,savedMerchants),profile,updates_unread:updatesUnread});
    }
    if(action==='updates'){
      const limit=Math.max(1,Math.min(50,Number(body.limit)||30));
      const [storedUpdates,unread]=await Promise.all([
        rows(db.from('marketplace_consumer_updates').select('id,kind,title,body,href,read_at,created_at,metadata').eq('consumer_id',cid).order('created_at',{ascending:false}).limit(limit)),
        count(db.from('marketplace_consumer_updates').select('id',{count:'exact',head:true}).eq('consumer_id',cid).is('read_at',null))
      ]);
      const publicDropIds=new Set((await publicCatalogueItems((storedUpdates||[]).filter((update:any)=>update.kind==='watch_match').map((update:any)=>clean(update.metadata?.drop_id,100)).filter(Boolean))).map((item:any)=>item.id));
      const updates=(storedUpdates||[]).map((update:any)=>{
        if(update.kind==='watch_match'&&!publicDropIds.has(clean(update.metadata?.drop_id,100)))return {...update,title:'A past Drop is no longer available',body:'A Drop that matched your alert is no longer available.',href:null,metadata:undefined};
        const {metadata,...safeUpdate}=update;
        return safeUpdate;
      });
      return reply({updates,unread});
    }
    if(action==='updates_read'){
      const now=new Date().toISOString();
      if(body.all===true)await rows(db.from('marketplace_consumer_updates').update({read_at:now}).eq('consumer_id',cid).is('read_at',null));
      else{
        const id=clean(body.id,64);
        if(!/^[a-f0-9-]{36}$/i.test(id))return reply({error:'invalid_update'},400);
        await rows(db.from('marketplace_consumer_updates').update({read_at:now}).eq('consumer_id',cid).eq('id',id).is('read_at',null));
      }
      return reply({ok:true});
    }
    if(action==='plans'){
      const plans=await rows(db.from('marketplace_plans').select('id,name,planned_for,note,group_details,share_created_at,share_revoked_at,created_at,updated_at').eq('consumer_id',cid).order('updated_at',{ascending:false}).limit(20));
      return reply({plans:await plansWithItems(plans||[])});
    }
    if(action==='plan_save'){
      const name=clean(body.name,100),note=clean(body.note,600),plannedFor=validDate(body.planned_for);
      const adults=Number(body.group_details?.adults??1),ages=body.group_details?.ages??[];
      if(!Number.isInteger(adults)||adults<1||adults>20||!Array.isArray(ages)||ages.length>12||ages.some((a:any)=>!Number.isInteger(a)||a<0||a>17))return reply({error:'invalid_group'},400);
      const group_details={adults,ages};
      const itemIds=unique(body.item_ids,PLAN_ITEM_LIMIT);
      if(!name)return reply({error:'plan_name_required'},400);
      if(plannedFor===null)return reply({error:'invalid_plan_date'},400);
      if(!itemIds.length)return reply({error:'plan_items_required'},400);
      const catalogue=await publicCatalogueItems(itemIds);
      if((catalogue||[]).length!==itemIds.length)return reply({error:'plan_item_not_found'},404);
      const existingId=clean(body.id,64);
      let plan:any;
      if(existingId){
        plan=await rows(db.from('marketplace_plans').update({name,note,group_details,planned_for:plannedFor||null,updated_at:new Date().toISOString()}).eq('id',existingId).eq('consumer_id',cid).select('id,name,planned_for,note,group_details,share_created_at,share_revoked_at,created_at,updated_at').maybeSingle());
        if(!plan)return reply({error:'plan_not_found'},404);
        await rows(db.from('marketplace_plan_items').delete().eq('plan_id',plan.id));
      }else{
        const planCount=await count(db.from('marketplace_plans').select('id',{count:'exact',head:true}).eq('consumer_id',cid));
        if(planCount>=20)return reply({error:'plan_limit_reached'},409);
        plan=await rows(db.from('marketplace_plans').insert({consumer_id:cid,name,note,group_details,planned_for:plannedFor||null}).select('id,name,planned_for,note,group_details,share_created_at,share_revoked_at,created_at,updated_at').single());
      }
      await rows(db.from('marketplace_plan_items').insert(itemIds.map((catalogue_item_id,position)=>({plan_id:plan.id,catalogue_item_id,position}))));
      const [result]=await plansWithItems([plan]);
      return reply({ok:true,plan:result});
    }
    if(action==='plan_delete'){
      const id=clean(body.id,64);
      const plan=await rows(db.from('marketplace_plans').delete().eq('id',id).eq('consumer_id',cid).select('id').maybeSingle());
      if(!plan)return reply({error:'plan_not_found'},404);
      return reply({ok:true});
    }
    if(action==='plan_share'){
      const id=clean(body.id,64);
      const plan=await rows(db.from('marketplace_plans').select('id').eq('id',id).eq('consumer_id',cid).maybeSingle());
      if(!plan)return reply({error:'plan_not_found'},404);
      if(body.revoke===true){
        await rows(db.from('marketplace_plans').update({share_revoked_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',plan.id));
        return reply({ok:true,shared:false});
      }
      const token=secret();
      await rows(db.from('marketplace_plans').update({share_token_hash:await hash(token),share_created_at:new Date().toISOString(),share_revoked_at:null,updated_at:new Date().toISOString()}).eq('id',plan.id));
      return reply({ok:true,shared:true,share_url:'https://perkdrop.au/plan/'+token});
    }
    if(action==='save'){
      if(!['drop','merchant'].includes(body.kind))return reply({error:'invalid_save'},400);
      const target=clean(body.target,100),table=body.kind==='drop'?'catalogue_items':'merchants';
      const exists=await rows(db.from(table).select('id').eq('id',target).maybeSingle());
      if(!exists)return reply({error:'target_not_found'},404);
      if(body.remove===true)await rows(db.from('marketplace_saves').delete().eq('consumer_id',cid).eq('kind',body.kind).eq('target',target));
      else await rows(db.from('marketplace_saves').upsert({consumer_id:cid,kind:body.kind,target},{onConflict:'consumer_id,kind,target'}));
      return reply({ok:true});
    }
    if(action==='recovery_link'){
      if(!await rpc('marketplace_rate_limit',{p_bucket:'recovery-link:'+cid,p_max:3,p_seconds:3600}))return reply({error:'rate_limited'},429);
      const token=secret(),tokenHash=await hash(token),expires=new Date(Date.now()+15*60000).toISOString();
      await rows(db.from('marketplace_recovery').insert({consumer_id:cid,token_hash:tokenHash,expires_at:expires}));
      await rows(db.from('marketplace_outbox').insert({consumer_id:cid,event:'identity_recovery',dedupe_key:'recovery:'+tokenHash,payload:{url:'https://perkdrop.au/recover#'+token}}));
      return reply({url:'https://perkdrop.au/recover#'+token,expires_at:expires,delivery:'private_link'});
    }
    return reply({error:'unknown_action'},400);
  }catch(e){
    const message=e instanceof Error?e.message:'';
    const known=['insufficient_capacity','direct_claim_not_allowed','offer_ended','offer_not_available','invalid_quantity','identity_required'].find(x=>message.includes(x));
    if(!known)console.error('marketplace request failed',message.replace(/[a-f0-9]{64}/g,'[redacted]'));
    return reply({error:known||'request_failed'},known?409:500);
  }
});
