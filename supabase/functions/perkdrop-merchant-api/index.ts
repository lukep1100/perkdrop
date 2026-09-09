import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const qualityFlags=(o:any,others:any[]=[])=>{const f:string[]=[];if(!o.media_url)f.push('no_image');if(o.metadata?.media_rights_confirmed!=='true'&&o.metadata?.media_rights_confirmed!==true)f.push('image_rights_unknown');if(!o.ends_at)f.push('no_expiry');if(!o.city||!o.location)f.push('bad_location');if(!o.conditions||o.conditions.trim().length<12)f.push('unclear_terms');if(o.normal_price!=null&&o.deal_price!=null&&Number(o.normal_price)<Number(o.deal_price))f.push('normal_price_suspicious');if(!(Number(o.normal_price)>Number(o.deal_price))&&!(Number(o.discount_percent)>0)&&o.discount_type!=='free')f.push('weak_value');if(!(o.capacity_total>0))f.push('no_capacity');if(!fulfilmentModes.includes(o.fulfilment_mode)||(o.action_type==='booking_claim'&&o.fulfilment_mode!=='booking_claim'))f.push('invalid_fulfilment');if(others.some(x=>x.id!==o.id&&x.merchant_id===o.merchant_id&&x.title===o.title&&x.starts_at===o.starts_at))f.push('duplicate');return f};
const evaluateAutopilot=(r:any,d:any)=>{const reasons:string[]=[];const discount=Number(d.normal_price)>0?(1-Number(d.deal_price)/Number(d.normal_price))*100:Number(d.discount_percent||0);const local=new Date(d.starts_at);if(!r.enabled)reasons.push('disabled');if(Number(d.deal_price)<Number(r.minimum_price))reasons.push('below_minimum_price');if(discount>Number(r.max_discount))reasons.push('discount_exceeded');if(!(d.capacity_total>0)||d.capacity_total>r.max_quantity)reasons.push('quantity_exceeded');if(!r.allowed_days?.includes(local.toLocaleDateString('en-AU',{weekday:'short',timeZone:r.timezone})))reasons.push('day_not_allowed');if(!r.allowed_hours?.includes(Number(local.toLocaleTimeString('en-AU',{hour:'2-digit',hour12:false,timeZone:r.timezone}))))reasons.push('hour_not_allowed');if(!r.drop_types?.includes(d.drop_type))reasons.push('type_not_allowed');return {eligible:!reasons.length,reasons,automatic_external_release:false}};

const CORS={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, content-type, apikey, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,'Content-Type':'application/json; charset=utf-8'}});
const clean=(v:unknown,max=1000)=>String(v??'').trim().slice(0,max);
const httpsUrl=(v:unknown)=>{const s=clean(v,1600);if(!s)return null;try{const u=new URL(s);return u.protocol==='https:'?u.toString():null}catch{return null}};
const num=(v:unknown,max=10000000)=>{if(v===null||v===''||v===undefined)return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=max?n:null};
const date=(v:unknown)=>{const s=clean(v,100);if(!s)return null;const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString()};
const capacity=(v:unknown)=>{const n=Number(v);return Number.isInteger(n)&&n>=1&&n<=10000?n:null};
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const discountTypes=['percent','fixed','deal_price','free','bogo','custom'];
const actionTypes=['redemption_code','booking','ticket_link','promo_code','external_purchase','affiliate_link','in_store_claim','free_claim'];
const verticals=['food','events','beauty','wellness','experiences','activities','fitness','stay','shopping','free','other'];
const dropTypes=['capacity','cancellation','last_minute','exclusive'];
const inventoryUnits=['diner','person','ticket','appointment','booking','room','tee_time','class_spot','item','package','other'];
const fulfilmentModes=['direct_claim','booking_claim','external_booking','ticket','appointment','merchant_confirmation','information_only'];
const fulfilmentFor=(action:string)=>action==='booking'?'booking_claim':action==='ticket_link'?'ticket':action==='external_purchase'?'external_booking':action==='free_claim'?'direct_claim':'direct_claim';
const uploadedMedia=(url:string|null,merchantId:string)=>Boolean(url&&url.includes(`/storage/v1/object/public/merchant-media/${merchantId}/`));

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
 if(!['GET','POST'].includes(req.method))return json({ok:false,error:'method_not_allowed'},405);
 try{
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const auth=req.headers.get('authorization')||'',token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';
  if(!token)return json({ok:false,error:'unauthorized'},401);
  const {data:userData,error:userError}=await service.auth.getUser(token),user=userData.user;
  if(userError||!user)return json({ok:false,error:'unauthorized'},401);
  const userEmail=clean(user.email,254).toLowerCase();
  const {data:members,error:memberError}=await service.from('merchant_members').select('merchant_id,role,status').eq('user_id',user.id).eq('status','active');
  if(memberError)return json({ok:false,error:'membership_failed'},500);
  const {data:groupMemberships,error:groupError}=await service.from('business_group_members').select('group_id,role').eq('user_id',user.id).eq('active',true);
  if(groupError)return json({ok:false,error:'group_membership_failed'},500);
  if(groupMemberships?.length){const {data:groupMerchants,error}=await service.from('merchants').select('id,business_group_id').in('business_group_id',groupMemberships.map(g=>g.group_id));if(error)return json({ok:false,error:'group_membership_failed'},500);for(const m of groupMerchants||[]){if(!members?.some(x=>x.merchant_id===m.id))members?.push({merchant_id:m.id,role:groupMemberships.find(g=>g.group_id===m.business_group_id)?.role==='admin'?'admin':'analyst',status:'active'})}}
  const merchantIds=(members||[]).map((m:any)=>m.merchant_id),roleFor=(id:string)=>members?.find((m:any)=>m.merchant_id===id)?.role||null;
  const canEdit=(id:string)=>['owner','admin','editor'].includes(roleFor(id)||''),canAdmin=(id:string)=>['owner','admin'].includes(roleFor(id)||'');
  const queue=async(eventType:string,merchantId:string|null,recipient:string,payload:any={})=>{if(!emailOk(recipient))return;try{await service.from('merchant_notification_outbox').insert({merchant_id:merchantId,event_type:eventType,recipient_email:recipient,payload})}catch{}};

  if(req.method==='GET'){
   if(!merchantIds.length){
    const [claimsR,ownershipR]=await Promise.all([
     service.from('merchant_claims').select('id,merchant_id,status,created_at,reviewed_at,metadata,merchants:merchant_id(name,slug,listing_status)').eq('user_id',user.id).order('created_at',{ascending:false}),
     service.from('merchant_ownership_requests').select('id,merchant_id,request_type,status,created_at,admin_notes,merchants:merchant_id(name,slug,listing_status)').eq('user_id',user.id).order('created_at',{ascending:false})
    ]);
    return json({ok:true,user:{id:user.id,email:userEmail},memberships:[],claims:claimsR.data||[],ownership_requests:ownershipR.data||[],merchants:[]});
   }
   const since=new Date(Date.now()-30*86400000).toISOString();
   const [merchantsR,offersR,termsR,campaignsR,eventsR,conversionsR,redemptionsR,ledgerR,profileR,ownershipR]=await Promise.all([
    service.from('merchants').select('id,name,slug,listing_status,partner_tier,claimable,description,cuisine,venue_type,primary_city,primary_state,primary_location,website_url,booking_url,instagram_url,facebook_url,tiktok_url,public_phone,public_email,logo_url,hero_image_url,opening_hours,facilities,media_rights_confirmed,image_rights_status,partner_since,verified_at,updated_at').in('id',merchantIds),
    service.from('merchant_offers').select('*').in('merchant_id',merchantIds).order('created_at',{ascending:false}).limit(250),
    service.from('merchant_commercial_terms').select('id,merchant_id,model,commission_flat,commission_rate,click_rate,monthly_fee,currency,affiliate_network,status,effective_from,effective_to').in('merchant_id',merchantIds).order('created_at',{ascending:false}),
    service.from('featured_campaigns').select('*').in('merchant_id',merchantIds).order('created_at',{ascending:false}).limit(100),
    service.from('engagement_events').select('merchant_id,event_type,created_at').in('merchant_id',merchantIds).gte('created_at',since).limit(10000),
    service.from('conversions').select('merchant_id,conversion_type,gross_value,commission_value,status,created_at').in('merchant_id',merchantIds).gte('created_at',since).limit(5000),
    service.from('redemptions').select('id,merchant_id,merchant_offer_id,catalogue_item_id,redemption_code,status,party_size,gross_value,discount_value,commission_value,currency,expires_at,redeemed_at,created_at').in('merchant_id',merchantIds).order('created_at',{ascending:false}).limit(500),
    service.from('commission_ledger').select('id,merchant_id,entry_type,gross_value,perkdrop_value,merchant_value,currency,status,occurred_at,payable_at,paid_at').in('merchant_id',merchantIds).order('occurred_at',{ascending:false}).limit(500),
    service.from('merchant_profile_change_requests').select('*').in('merchant_id',merchantIds).order('created_at',{ascending:false}).limit(100),
    service.from('merchant_ownership_requests').select('*').in('merchant_id',merchantIds).order('created_at',{ascending:false}).limit(100)
   ]);
   if(merchantsR.error)return json({ok:false,error:'merchant_load_failed'},500);
   const stats:Record<string,any>={};for(const id of merchantIds)stats[id]={impressions:0,deal_views:0,listing_views:0,website_clicks:0,directions:0,calls:0,saves:0,shares:0,claim_submits:0,redemptions:0,bookings:0,gross_value:0,commission_value:0,claims:0,diners_delivered:0,diners_redeemed:0,fees_accrued:0};
   for(const e of eventsR.data||[]){const s=stats[e.merchant_id];if(!s)continue;const map:any={impression:'impressions',deal_view:'deal_views',deal_open:'deal_views',listing_view:'listing_views',website_click:'website_clicks',official_deal_click:'website_clicks',directions:'directions',directions_click:'directions',call:'calls',save:'saves',save_toggle:'saves',share:'shares',claim_submit:'claim_submits',redemption_complete:'redemptions',booking_complete:'bookings'};const k=map[e.event_type];if(k)s[k]++}
   for(const c of conversionsR.data||[]){const s=stats[c.merchant_id];if(!s)continue;s.gross_value+=Number(c.gross_value||0);s.commission_value+=Number(c.commission_value||0);if(c.status==='approved'||c.status==='paid'){if(c.conversion_type==='booking')s.bookings++;else s.redemptions++}}
   for(const r of redemptionsR.data||[]){const s=stats[r.merchant_id];if(!s)continue;s.claims++;s.diners_delivered+=Number(r.party_size||1);if(r.status==='redeemed')s.diners_redeemed+=Number(r.party_size||1)}
   for(const l of ledgerR.data||[]){const s=stats[l.merchant_id];if(s&&l.status!=='void')s.fees_accrued+=Number(l.perkdrop_value||0)}
   const output=(merchantsR.data||[]).map((m:any)=>({...m,role:roleFor(m.id),stats_30d:stats[m.id]||{},offers:(offersR.data||[]).filter((o:any)=>o.merchant_id===m.id),commercial_terms:(termsR.data||[]).filter((t:any)=>t.merchant_id===m.id),featured_campaigns:(campaignsR.data||[]).filter((c:any)=>c.merchant_id===m.id),redemptions:(redemptionsR.data||[]).filter((r:any)=>r.merchant_id===m.id),ledger:(ledgerR.data||[]).filter((l:any)=>l.merchant_id===m.id),profile_change_requests:(profileR.data||[]).filter((x:any)=>x.merchant_id===m.id),ownership_requests:(ownershipR.data||[]).filter((x:any)=>x.merchant_id===m.id)}));
   return json({ok:true,user:{id:user.id,email:userEmail},merchants:output});
  }

  const body=await req.json().catch(()=>null) as any;if(!body||typeof body!=='object')return json({ok:false,error:'invalid_body'},400);
  const action=clean(body.action,80),merchantId=clean(body.merchant_id,80);if(!merchantId||!merchantIds.includes(merchantId))return json({ok:false,error:'merchant_access_denied'},403);

  if(action==='confirmation_decide'){
    const {data,error}=await service.rpc('marketplace_confirm',{p_actor:user.id,p_merchant:merchantId,p_redemption:clean(body.redemption_id,80),p_accept:body.accept});
    if(error)return json({ok:false,error:'confirmation_failed'},409);return json({ok:true,...data});
  }
  if(action==='publish'){
    const {data,error}=await service.rpc('marketplace_publish',{p_actor:user.id,p_merchant:merchantId,p_offer:clean(body.offer_id,80)});
    if(error)return json({ok:false,error:clean(error.message,180)},409);return json({ok:true,offer:data});
  }
  if(action==='autopilot_get'){
    const {data,error}=await service.from('merchant_autopilot').select('rule').eq('merchant_id',merchantId).maybeSingle();if(error)return json({ok:false,error:'autopilot_failed'},500);return json({ok:true,rule:data?.rule||null,automatic_external_release:false});
  }
  if(action==='autopilot_save'){
    if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);
    const r=body.rule||{};if(!Number.isFinite(r.max_discount)||r.max_discount<0||r.max_discount>100||!Number.isFinite(r.minimum_price)||r.minimum_price<0||!Number.isInteger(r.max_quantity)||r.max_quantity<1||r.max_quantity>10000||!Array.isArray(r.allowed_days)||!Array.isArray(r.allowed_hours)||!Array.isArray(r.drop_types)||!Number.isFinite(r.min_lead_minutes)||r.min_lead_minutes<0||!Number.isFinite(r.max_lead_minutes)||r.max_lead_minutes<r.min_lead_minutes)return json({ok:false,error:'invalid_autopilot_rule'},400);
    try{new Intl.DateTimeFormat('en-AU',{timeZone:r.timezone});}catch{return json({ok:false,error:'invalid_timezone'},400)}
    const rule={enabled:r.enabled===true,max_discount:r.max_discount,minimum_price:r.minimum_price,max_quantity:r.max_quantity,allowed_days:r.allowed_days.filter((x:any)=>['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].includes(x)),allowed_hours:r.allowed_hours.filter((x:any)=>Number.isInteger(x)&&x>=0&&x<=23),drop_types:r.drop_types.filter((x:any)=>dropTypes.includes(x)),min_lead_minutes:r.min_lead_minutes,max_lead_minutes:r.max_lead_minutes,timezone:r.timezone,blackouts:Array.isArray(r.blackouts)?r.blackouts.filter((b:any)=>date(b.start)&&date(b.end)&&new Date(b.end)>new Date(b.start)).slice(0,50):[]};
    const {error}=await service.from('merchant_autopilot').upsert({merchant_id:merchantId,rule,updated_by:user.id,updated_at:new Date().toISOString()});if(error)return json({ok:false,error:'autopilot_save_failed'},500);return json({ok:true,rule,automatic_external_release:false});
  }
  if(action==='quality'){
    const {data:offers,error}=await service.from('merchant_offers').select('*').eq('merchant_id',merchantId).limit(250);if(error)return json({ok:false,error:'quality_failed'},500);
    const {data:autopilot}=await service.from('merchant_autopilot').select('rule').eq('merchant_id',merchantId).maybeSingle();
    return json({ok:true,offers:(offers||[]).map(o=>({id:o.id,flags:qualityFlags(o,offers),autopilot:autopilot?.rule&&o.starts_at?evaluateAutopilot(autopilot.rule,o):null}))});
  }
  if(action==='demand'){
    const {data,error}=await service.rpc('marketplace_demand',{p_actor:user.id,p_merchant:merchantId});
    if(error)return json({ok:false,error:'demand_failed'},409);return json({ok:true,opportunities:data});
  }
  if(action==='performance'){
    const {data:offers,error}=await service.from('merchant_offers').select('id').eq('merchant_id',merchantId).order('created_at',{ascending:false}).limit(250);
    if(error)return json({ok:false,error:'performance_failed'},500);
    const reports=[];for(const o of offers||[]){const {data,error}=await service.rpc('marketplace_offer_roi',{p_offer:o.id});if(error)return json({ok:false,error:'performance_failed'},500);reports.push(data)}
    const {data:snapshots,error:snapshotError}=await service.from('merchant_report_snapshots').select('offer_id,snapshot,created_at').eq('merchant_id',merchantId).order('created_at',{ascending:false}).limit(100);
    if(snapshotError)return json({ok:false,error:'reports_failed'},500);
    return json({ok:true,reports,snapshots,limit:250});
  }

  if(action==='profile_update'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const patch:any={};
   for(const f of ['description','cuisine','venue_type','public_phone','public_email'])if(body[f]!==undefined)patch[f]=clean(body[f],f==='description'?3000:500)||null;
   for(const f of ['website_url','booking_url','instagram_url','facebook_url','tiktok_url','logo_url','hero_image_url'])if(body[f]!==undefined)patch[f]=httpsUrl(body[f]);
   if(body.media_rights_confirmed!==undefined)patch.media_rights_confirmed=body.media_rights_confirmed===true;
   if(body.hero_image_url!==undefined){const hero=httpsUrl(body.hero_image_url);if(hero&&body.media_rights_confirmed===true){patch.image_rights_status='merchant_authorised';patch.image_candidate_url=hero;patch.image_candidate_source_url=hero}else if(!hero)patch.image_rights_status='missing'}
   if(body.opening_hours!==undefined)patch.opening_hours=body.opening_hours&&typeof body.opening_hours==='object'&&!Array.isArray(body.opening_hours)?body.opening_hours:{};
   if(body.facilities!==undefined)patch.facilities=Array.isArray(body.facilities)?body.facilities.slice(0,50).map((x:any)=>clean(x,120)).filter(Boolean):[];
   const {data,error}=await service.from('merchants').update(patch).eq('id',merchantId).select('id,name,slug,listing_status,partner_tier,updated_at').single();if(error)return json({ok:false,error:'profile_update_failed'},500);await queue('profile_updated',merchantId,userEmail,{merchant_name:data.name});return json({ok:true,merchant:data});
  }

  if(action==='profile_change_request'){
   if(!canAdmin(merchantId))return json({ok:false,error:'role_denied'},403);const requested:any={};if(body.name!==undefined)requested.name=clean(body.name,180);if(body.primary_location!==undefined)requested.primary_location=clean(body.primary_location,500);if(body.primary_city!==undefined)requested.primary_city=clean(body.primary_city,120).toLowerCase().replace(/\s+/g,'-');if(body.primary_state!==undefined)requested.primary_state=clean(body.primary_state,80).toUpperCase();if(!Object.keys(requested).length||Object.values(requested).every(v=>!v))return json({ok:false,error:'no_sensitive_changes'},400);const {data,error}=await service.from('merchant_profile_change_requests').insert({merchant_id:merchantId,user_id:user.id,requested_patch:requested,status:'pending'}).select('*').single();if(error)return json({ok:false,error:'profile_change_request_failed'},500);await queue('profile_change_received',merchantId,userEmail,{request_id:data.id,requested_patch:requested});return json({ok:true,request:data},201);
  }

  if(action==='ownership_issue'){
   if(!canAdmin(merchantId))return json({ok:false,error:'role_denied'},403);const requestType=['dispute','transfer'].includes(clean(body.request_type,40))?clean(body.request_type,40):'dispute',reason=clean(body.reason,3000),contactName=clean(body.contact_name,180)||clean(user.user_metadata?.full_name,180)||'Business representative';if(!reason)return json({ok:false,error:'reason_required'},400);const {data,error}=await service.from('merchant_ownership_requests').insert({merchant_id:merchantId,user_id:user.id,request_type:requestType,contact_name:contactName,contact_email:userEmail,reason,evidence_url:httpsUrl(body.evidence_url),status:'pending'}).select('*').single();if(error)return json({ok:false,error:'ownership_request_failed'},500);await queue('ownership_request_received',merchantId,userEmail,{request_id:data.id,request_type:requestType});return json({ok:true,request:data},201);
  }

  if(action==='offer_create'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const title=clean(body.title,220),description=clean(body.description,4000);if(!title||!description)return json({ok:false,error:'title_and_description_required'},400);const cap=capacity(body.capacity_total);if(cap===null)return json({ok:false,error:'capacity_required_1_to_10000'},400);const discountType=discountTypes.includes(clean(body.discount_type,40))?clean(body.discount_type,40):'custom',actionType=actionTypes.includes(clean(body.action_type,40))?clean(body.action_type,40):'redemption_code',starts=date(body.starts_at),ends=date(body.ends_at);if(starts&&ends&&new Date(ends)<=new Date(starts))return json({ok:false,error:'end_must_be_after_start'},400);const media=httpsUrl(body.media_url),rights=body.media_rights_confirmed===true||uploadedMedia(media,merchantId);const payload:any={merchant_id:merchantId,created_by:user.id,title,description,category:clean(body.category,100)||null,vertical:verticals.includes(clean(body.vertical,40))?clean(body.vertical,40):'other',drop_type:dropTypes.includes(clean(body.drop_type,40))?clean(body.drop_type,40):'capacity',inventory_unit:inventoryUnits.includes(clean(body.inventory_unit,40))?clean(body.inventory_unit,40):'person',fulfilment_mode:fulfilmentModes.includes(clean(body.fulfilment_mode,40))?clean(body.fulfilment_mode,40):fulfilmentFor(actionType),booking_provider:clean(body.booking_provider,80)||null,visibility:['public','private','invite_only'].includes(clean(body.visibility,30))?clean(body.visibility,30):'public',cuisine:clean(body.cuisine,120)||null,venue_type:clean(body.venue_type,120)||null,discount_type:discountType,action_type:actionType,discount_percent:num(body.discount_percent,100),normal_price:num(body.normal_price),deal_price:num(body.deal_price),promo_code:clean(body.promo_code,120)||null,conditions:clean(body.conditions,4000)||null,starts_at:starts,ends_at:ends,recurring_schedule:(body.recurring_schedule&&typeof body.recurring_schedule==='object')?body.recurring_schedule:{},capacity_total:cap,capacity_remaining:cap,redemption_limit_per_user:Number.isInteger(Number(body.redemption_limit_per_user))&&Number(body.redemption_limit_per_user)>0?Number(body.redemption_limit_per_user):1,location:clean(body.location,400)||null,city:clean(body.city,100)||null,state:clean(body.state,80)||null,latitude:num(body.latitude,90),longitude:num(body.longitude,180),booking_url:httpsUrl(body.booking_url),media_url:media,exclusive:body.exclusive===true,affiliate_url:httpsUrl(body.affiliate_url),affiliate_network:clean(body.affiliate_network,120)||null,status:'draft',metadata:{media_rights_confirmed:Boolean(media&&rights),media_authorised_by_user:media&&rights?user.id:null,media_authorised_at:media&&rights?new Date().toISOString():null}};const {data,error}=await service.from('merchant_offers').insert(payload).select('*').single();if(error){console.error(error);return json({ok:false,error:'offer_create_failed'},500)}return json({ok:true,offer:data},201);
  }

  if(action==='offer_update'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const offerId=clean(body.offer_id,80);const {data:offer}=await service.from('merchant_offers').select('id,status,capacity_total,capacity_remaining,starts_at,ends_at,metadata,media_url').eq('id',offerId).eq('merchant_id',merchantId).maybeSingle();if(!offer)return json({ok:false,error:'offer_not_found'},404);if(!['draft','paused','rejected'].includes(offer.status))return json({ok:false,error:'offer_locked'},409);const patch:any={};for(const f of ['title','description','category','cuisine','venue_type','promo_code','conditions','location','city','state','affiliate_network','action_type','booking_provider'])if(body[f]!==undefined)patch[f]=clean(body[f],f==='description'||f==='conditions'?4000:500)||null;if(body.vertical!==undefined&&verticals.includes(clean(body.vertical,40)))patch.vertical=clean(body.vertical,40);if(body.drop_type!==undefined&&dropTypes.includes(clean(body.drop_type,40)))patch.drop_type=clean(body.drop_type,40);if(body.inventory_unit!==undefined&&inventoryUnits.includes(clean(body.inventory_unit,40)))patch.inventory_unit=clean(body.inventory_unit,40);if(body.fulfilment_mode!==undefined&&fulfilmentModes.includes(clean(body.fulfilment_mode,40)))patch.fulfilment_mode=clean(body.fulfilment_mode,40);if(body.visibility!==undefined&&['public','private','invite_only'].includes(clean(body.visibility,30)))patch.visibility=clean(body.visibility,30);for(const f of ['booking_url','media_url','affiliate_url'])if(body[f]!==undefined)patch[f]=httpsUrl(body[f]);for(const f of ['discount_percent','normal_price','deal_price'])if(body[f]!==undefined)patch[f]=num(body[f],f==='discount_percent'?100:10000000);for(const f of ['starts_at','ends_at'])if(body[f]!==undefined)patch[f]=date(body[f]);if(body.exclusive!==undefined)patch.exclusive=body.exclusive===true;if(body.recurring_schedule&&typeof body.recurring_schedule==='object')patch.recurring_schedule=body.recurring_schedule;if(body.action_type!==undefined&&!actionTypes.includes(clean(body.action_type,40)))return json({ok:false,error:'invalid_action_type'},400);if(body.discount_type!==undefined){const dt=clean(body.discount_type,40);if(!discountTypes.includes(dt))return json({ok:false,error:'invalid_discount_type'},400);patch.discount_type=dt}if(body.capacity_total!==undefined){const cap=capacity(body.capacity_total);if(cap===null)return json({ok:false,error:'capacity_required_1_to_10000'},400);const used=Math.max(0,Number(offer.capacity_total||0)-Number(offer.capacity_remaining||0));if(cap<used)return json({ok:false,error:'capacity_below_already_claimed'},409);patch.capacity_total=cap;/* capacity_remaining is computed under the row lock by the database trigger */}const finalStarts=patch.starts_at!==undefined?patch.starts_at:offer.starts_at,finalEnds=patch.ends_at!==undefined?patch.ends_at:offer.ends_at;if(finalStarts&&finalEnds&&new Date(finalEnds)<=new Date(finalStarts))return json({ok:false,error:'end_must_be_after_start'},400);if(body.media_url!==undefined||body.media_rights_confirmed!==undefined){const media=patch.media_url!==undefined?patch.media_url:offer.media_url,rights=body.media_rights_confirmed===true||uploadedMedia(media,merchantId);patch.metadata={...(offer.metadata||{}),media_rights_confirmed:Boolean(media&&rights),media_authorised_by_user:media&&rights?user.id:null,media_authorised_at:media&&rights?new Date().toISOString():null}}patch.status='draft';patch.metadata={...(patch.metadata||offer.metadata||{}),requires_review:true};const {data,error}=await service.from('merchant_offers').update(patch).eq('id',offerId).eq('merchant_id',merchantId).in('status',['draft','paused','rejected']).select('*').single();if(error)return json({ok:false,error:'offer_update_failed'},500);return json({ok:true,offer:data});
  }

  if(action==='offer_submit'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const offerId=clean(body.offer_id,80);const {data:ready}=await service.from('merchant_offers').select('id,title,capacity_total,starts_at,ends_at').eq('id',offerId).eq('merchant_id',merchantId).maybeSingle();if(!ready||!ready.capacity_total||Number(ready.capacity_total)<1)return json({ok:false,error:'capacity_required_before_submit'},409);if(ready.starts_at&&ready.ends_at&&new Date(ready.ends_at)<=new Date(ready.starts_at))return json({ok:false,error:'end_must_be_after_start'},400);const {data,error}=await service.from('merchant_offers').update({status:'pending',review_notes:null}).eq('id',offerId).eq('merchant_id',merchantId).in('status',['draft','paused','rejected']).select('*').maybeSingle();if(error||!data)return json({ok:false,error:'offer_submit_failed'},409);await queue('drop_submitted',merchantId,userEmail,{offer_id:offerId,title:ready.title});return json({ok:true,offer:data});
  }

  if(['offer_resume','offer_close','offer_capacity','offer_pause'].includes(action)){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);
   const {data,error}=await service.rpc('merchant_offer_control',{p_actor:user.id,p_merchant:merchantId,p_offer:clean(body.offer_id,80),p_action:action,p_capacity:action==='offer_capacity'?capacity(body.capacity_total):null});
   if(error){const known=['merchant_access_denied','offer_not_found','offer_not_resumable','offer_ended','offer_not_active','offer_not_open','invalid_capacity','session_capacity_required','capacity_not_configured','capacity_below_already_claimed'].find(x=>error.message.includes(x));return json({ok:false,error:known||'offer_control_failed'},409)}
   return json({ok:true,offer:data});
  }

  if(['offer_duplicate','offer_repeat'].includes(action)){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const offerId=clean(body.offer_id,80);const {data:source}=await service.from('merchant_offers').select('*').eq('id',offerId).eq('merchant_id',merchantId).maybeSingle();if(!source)return json({ok:false,error:'offer_not_found'},404);const starts=date(body.starts_at)||date(source.starts_at),ends=date(body.ends_at)||date(source.ends_at);if(action==='offer_repeat'&&!starts)return json({ok:false,error:'future_start_required'},400);if(starts&&new Date(starts)<=new Date())return json({ok:false,error:'start_must_be_future'},400);if(starts&&ends&&new Date(ends)<=new Date(starts))return json({ok:false,error:'end_must_be_after_start'},400);const copy:any={...source};for(const key of ['id','created_at','updated_at','published_drop_id','review_notes','approved_at','approved_by'])delete copy[key];copy.created_by=user.id;copy.status='draft';copy.starts_at=starts;copy.ends_at=ends;copy.capacity_remaining=copy.capacity_total;copy.title=action==='offer_repeat'?`${copy.title} (repeat)`:copy.title;const {data,error}=await service.from('merchant_offers').insert(copy).select('*').single();if(error){console.error(error);return json({ok:false,error:'offer_copy_failed'},500)}return json({ok:true,offer:data},201)
  }

  if(action==='template_list'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const {data,error}=await service.from('merchant_offer_templates').select('*').eq('merchant_id',merchantId).eq('active',true).order('updated_at',{ascending:false});if(error)return json({ok:false,error:'template_load_failed'},500);return json({ok:true,templates:data||[]})
  }
  if(action==='template_save'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const name=clean(body.name,120);if(!name||!body.template_payload||typeof body.template_payload!=='object')return json({ok:false,error:'template_name_and_payload_required'},400);const {data,error}=await service.from('merchant_offer_templates').insert({merchant_id:merchantId,created_by:user.id,name,template_payload:body.template_payload}).select('*').single();if(error)return json({ok:false,error:'template_save_failed'},500);return json({ok:true,template:data},201)
  }
  if(action==='template_delete'){
   if(!canAdmin(merchantId))return json({ok:false,error:'role_denied'},403);const id=clean(body.template_id,80);const {data,error}=await service.from('merchant_offer_templates').update({active:false,updated_at:new Date().toISOString()}).eq('id',id).eq('merchant_id',merchantId).select('*').maybeSingle();if(error||!data)return json({ok:false,error:'template_delete_failed'},409);return json({ok:true,template:data})
  }

  if(action==='offer_pause'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const offerId=clean(body.offer_id,80);const {data,error}=await service.from('merchant_offers').update({status:'paused'}).eq('id',offerId).eq('merchant_id',merchantId).eq('status','active').select('*').maybeSingle();if(error||!data)return json({ok:false,error:'offer_pause_failed'},409);if(data.published_drop_id)await service.from('catalogue_items').update({active:false}).eq('id',data.published_drop_id);await queue('drop_paused',merchantId,userEmail,{offer_id:offerId,published_drop_id:data.published_drop_id||null,title:data.title});return json({ok:true,offer:data});
  }

  if(action==='featured_request'){
   if(!canAdmin(merchantId))return json({ok:false,error:'role_denied'},403);const starts=date(body.starts_at),ends=date(body.ends_at);if(!starts||!ends||new Date(ends)<=new Date(starts))return json({ok:false,error:'invalid_dates'},400);const placement=['feed','city_top','category_top','map','social','push','email','bundle'].includes(clean(body.placement,40))?clean(body.placement,40):'feed';const {data,error}=await service.from('featured_campaigns').insert({merchant_id:merchantId,merchant_offer_id:clean(body.offer_id,80)||null,placement,pricing_model:'flat',starts_at:starts,ends_at:ends,status:'draft',metadata:{requested_by:user.id}}).select('*').single();if(error)return json({ok:false,error:'featured_request_failed'},500);return json({ok:true,campaign:data},201);
  }

  if(action==='redeem'){
   if(!canEdit(merchantId))return json({ok:false,error:'role_denied'},403);const code=clean(body.redemption_code,100).toUpperCase();if(!code)return json({ok:false,error:'code_required'},400);const {data,error}=await service.rpc('redeem_merchant_redemption',{p_merchant_id:merchantId,p_redemption_code:code,p_merchant_reference:clean(body.merchant_reference,200)||null});if(error){const m=String(error.message||'');const name=['redemption_not_found','redemption_not_available','redemption_expired'].find(x=>m.includes(x));return json({ok:false,error:name||'redeem_failed'},name?409:500)}try{await service.from('engagement_events').insert({merchant_id:merchantId,merchant_offer_id:data.merchant_offer_id,catalogue_item_id:data.catalogue_item_id,event_type:'redemption_complete',metadata:{redemption_id:data.id,party_size:data.party_size}})}catch{}return json({ok:true,redemption:data});
  }

  return json({ok:false,error:'unknown_action'},400);
 }catch(e){console.error('perkdrop-merchant-api',e);return json({ok:false,error:'merchant_api_failed'},500)}
});
