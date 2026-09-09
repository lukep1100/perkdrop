import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const UNION_DROP_ID='UNION-HOTEL-LUNCH-20-OFF';
const allowedOrigin=(origin:string)=>{try{const h=new URL(origin).host;return h==='perkdrop.au'||h==='www.perkdrop.au'||h==='khzpdyyywiucfhubxkev.supabase.co'||(h.endsWith('.vercel.app')&&h.includes('perkdrop'))}catch{return false}};
const cors=(req:Request)=>{const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowedOrigin(o)?o:'https://perkdrop.au','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'}};
const json=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8','X-Content-Type-Options':'nosniff'}});
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max);
const code=()=>`PD-${crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}`;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE=/^\d{4}-\d{2}-\d{2}$/;
const allowedBookingUrl=(v:string)=>{try{const u=new URL(v);return u.protocol==='https:'&&u.hostname==='bookings.nowbookit.com'?u.toString():''}catch{return ''}};
const hash=async(v:string)=>{const raw=`${Deno.env.get('PERKDROP_HASH_SALT')||'perkdrop'}:${v}`;const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)));return Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('')};
const localNow=(tz='Australia/Adelaide')=>{const parts=new Intl.DateTimeFormat('en-AU',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const m:any={};for(const p of parts)m[p.type]=p.value;return{date:`${m.year}-${m.month}-${m.day}`,minutes:Number(m.hour)*60+Number(m.minute)}};
const mins=(v:any)=>{const [h,m]=String(v||'00:00').split(':').map(Number);return (h||0)*60+(m||0)};
const cleanAttribution=(a:any)=>({utm_source:clean(a?.utm_source,60).toLowerCase()||null,utm_medium:clean(a?.utm_medium,60).toLowerCase()||null,utm_campaign:clean(a?.utm_campaign,140)||null,fbclid:clean(a?.fbclid,500)||null,landing_url:clean(a?.landing_url,700)||null});
const attribution=(b:any)=>cleanAttribution(b?.attribution&&typeof b.attribution==='object'?b.attribution:{});
const dropFor=(offer:any)=>clean(offer?.published_drop_id||offer?.metadata?.catalogue_item_id||UNION_DROP_ID,80)||null;

async function resolveOffer(service:any,offerId:string,dropId:string){
  let offer:any=null;
  if(offerId&&UUID.test(offerId)){const {data}=await service.from('merchant_offers').select('id,merchant_id,published_drop_id,title,description,discount_percent,conditions,booking_url,action_type,status,metadata').eq('id',offerId).eq('status','active').maybeSingle();offer=data}
  if(!offer&&dropId){const {data}=await service.from('merchant_offers').select('id,merchant_id,published_drop_id,title,description,discount_percent,conditions,booking_url,action_type,status,metadata').eq('published_drop_id',dropId).eq('status','active').maybeSingle();offer=data}
  if(!offer||offer.action_type!=='booking_claim')return null;
  return offer;
}

async function inferAttribution(service:any,req:Request,provided:any){
  const cleanProvided=cleanAttribution(provided||{});
  if(cleanProvided.utm_source)return cleanProvided;
  try{
    const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'').split(',')[0].trim();
    if(!ip)return cleanProvided;
    const ipHash=await hash(ip),ua=clean(req.headers.get('user-agent'),500),since=new Date(Date.now()-4*3600000).toISOString();
    let query=service.from('engagement_events').select('metadata,user_agent,created_at').eq('catalogue_item_id',UNION_DROP_ID).eq('source_ip_hash',ipHash).gte('created_at',since).order('created_at',{ascending:false}).limit(30);
    if(ua)query=query.eq('user_agent',ua);
    const {data}=await query;
    const match=(data||[]).find((row:any)=>clean(row?.metadata?.utm_source,60));
    return match?cleanAttribution(match.metadata):cleanProvided;
  }catch{return cleanProvided}
}

async function logEvent(service:any,req:Request,offer:any,eventType:string,sessionId:string,meta:any={}){
  try{
    const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'').split(',')[0].trim();
    const ipHash=ip?await hash(ip):null;
    await service.from('engagement_events').insert({merchant_id:offer.merchant_id,merchant_offer_id:offer.id,catalogue_item_id:dropFor(offer),event_type:eventType,session_id:sessionId||null,city:'adelaide',source_page:'/deals/union-hotel-20-off-lunch',source_ip_hash:ipHash,user_agent:clean(req.headers.get('user-agent'),500)||null,metadata:meta});
  }catch{}
}

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
  const origin=req.headers.get('origin')||'';
  if(origin&&!allowedOrigin(origin))return json(req,{ok:false,error:'origin_not_allowed'},403);
  try{
    const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});

    if(req.method==='GET'){
      await service.rpc('reconcile_expired_booking_allocations');
      const u=new URL(req.url),offerId=clean(u.searchParams.get('offer'),80),dropId=clean(u.searchParams.get('drop'),80);
      const offer=await resolveOffer(service,offerId,dropId);
      if(!offer)return json(req,{ok:false,error:'booking_claim_not_available'},404);
      const [{data:merchant},{data:sessions,error:sessionError}]=await Promise.all([
        service.from('merchants').select('id,name,slug,primary_location,public_phone,website_url,booking_url,hero_image_url,listing_status,partner_tier').eq('id',offer.merchant_id).maybeSingle(),
        service.from('offer_sessions').select('id,service_date,timezone,service_start,service_end,capacity_total,capacity_remaining,status').eq('merchant_offer_id',offer.id).eq('status','active').order('service_date',{ascending:true}).limit(40)
      ]);
      if(sessionError)return json(req,{ok:false,error:'availability_failed'},500);
      const publicSessions=(sessions||[]).filter((s:any)=>{const now=localNow(s.timezone||'Australia/Adelaide');return String(s.service_date)>now.date||(String(s.service_date)===now.date&&mins(s.service_end)>now.minutes)}).map((s:any)=>({id:s.id,service_date:s.service_date,timezone:s.timezone,service_start:String(s.service_start||'').slice(0,5),service_end:String(s.service_end||'').slice(0,5),capacity_total:Number(s.capacity_total)||0,capacity_remaining:Number(s.capacity_remaining)||0}));
      const bookingUrl=allowedBookingUrl(clean(offer.booking_url||merchant?.booking_url,1600));
      if(!bookingUrl)return json(req,{ok:false,error:'booking_provider_not_configured'},409);
      return json(req,{ok:true,offer:{id:offer.id,drop_id:dropFor(offer),title:offer.title,description:offer.description,discount_percent:offer.discount_percent===null?null:Number(offer.discount_percent),conditions:offer.conditions||'',booking_url:bookingUrl,metadata:offer.metadata||{}},merchant:{id:merchant?.id||offer.merchant_id,name:merchant?.name||'Venue',slug:merchant?.slug||'',location:merchant?.primary_location||'',phone:merchant?.public_phone||'',website_url:merchant?.website_url||'',hero_image_url:merchant?.hero_image_url||'',listing_status:merchant?.listing_status||'',partner_tier:merchant?.partner_tier||''},sessions:publicSessions});
    }

    if(req.method!=='POST')return json(req,{ok:false,error:'method_not_allowed'},405);
    const body=await req.json().catch(()=>null) as any;
    if(!body||typeof body!=='object')return json(req,{ok:false,error:'invalid_body'},400);
    const action=clean(body.action,40),sessionId=clean(body.session_id,120);
    if(!/^[a-zA-Z0-9:_-]{12,120}$/.test(sessionId))return json(req,{ok:false,error:'missing_session_id'},400);
    const attr=await inferAttribution(service,req,attribution(body));

    if(action==='hold'){
      const offerId=clean(body.offer_id,80),serviceDate=clean(body.service_date,20),partySize=Number(body.party_size);
      if(!UUID.test(offerId)||!DATE.test(serviceDate)||!Number.isInteger(partySize)||partySize<1||partySize>6)return json(req,{ok:false,error:'invalid_hold_request'},400);
      const offer=await resolveOffer(service,offerId,'');
      if(!offer)return json(req,{ok:false,error:'booking_claim_not_available'},404);
      const {data,error}=await service.rpc('create_booking_hold',{p_offer_id:offer.id,p_service_date:serviceDate,p_session_id:sessionId,p_party_size:partySize,p_hold_minutes:10});
      if(error){const m=String(error.message||'');const known=['invalid_party_size','missing_session_id','booking_claim_not_available','session_not_available','insufficient_capacity'];const name=known.find(x=>m.includes(x))||'hold_failed';return json(req,{ok:false,error:name},name==='insufficient_capacity'?409:400)}
      const hold=(data as any)?.hold||{};
      if(hold?.id)await service.from('booking_claim_holds').update({metadata:{...(hold.metadata||{}),attribution:attr}}).eq('id',hold.id);
      if(!(data as any)?.reused)await logEvent(service,req,offer,'hold_created',sessionId,{...attr,service_date:serviceDate,party_size:partySize,hold_token:hold.hold_token||null});
      return json(req,{ok:true,reused:Boolean((data as any)?.reused),confirmed:Boolean((data as any)?.confirmed),hold:{token:hold.hold_token,party_size:hold.party_size,status:hold.status,expires_at:hold.expires_at,service_date:hold.metadata?.service_date||serviceDate},capacity_remaining:(data as any)?.capacity_remaining},201);
    }

    if(action==='release'){
      const token=clean(body.hold_token,80);
      if(!UUID.test(token))return json(req,{ok:false,error:'invalid_hold_token'},400);
      const {data:hold}=await service.from('booking_claim_holds').select('merchant_offer_id,metadata,party_size').eq('hold_token',token).eq('session_id',sessionId).maybeSingle();
      const {data,error}=await service.rpc('release_booking_hold',{p_hold_token:token,p_session_id:sessionId});
      if(error)return json(req,{ok:false,error:'release_failed'},400);
      if((data as any)?.released&&hold){const offer=await resolveOffer(service,hold.merchant_offer_id,'');if(offer)await logEvent(service,req,offer,'hold_released',sessionId,{...(hold.metadata?.attribution||attr),service_date:hold.metadata?.service_date||null,party_size:hold.party_size,hold_token:token})}
      return json(req,{ok:true,...(data||{})});
    }

    if(action==='confirm'){
      const token=clean(body.hold_token,80),event=body.event&&typeof body.event==='object'?body.event:{};
      if(!UUID.test(token))return json(req,{ok:false,error:'invalid_hold_token'},400);
      const conversionText=[event.event_action,event.eventAction,event.event,event.page_title,event.event_category,event.eventCategory].map(x=>clean(x,160)).join(' ').toLowerCase();
      if(!/booking confirmed|thank you|booking paid/.test(conversionText))return json(req,{ok:false,error:'booking_confirmation_required'},400);
      const safeEvent={event:clean(event.event,120),event_action:clean(event.event_action||event.eventAction,120),event_category:clean(event.event_category||event.eventCategory,120),event_label:clean(event.event_label||event.eventLabel,220),page_title:clean(event.page_title,160),page_url:clean(event.page_url,500)};
      const reference=clean(body.booking_reference||safeEvent.event_label,160);
      const {data:hold}=await service.from('booking_claim_holds').select('merchant_offer_id,metadata,party_size').eq('hold_token',token).eq('session_id',sessionId).maybeSingle();
      const holdAttr=hold?.metadata?.attribution||attr;
      const {data,error}=await service.rpc('confirm_booking_hold',{p_hold_token:token,p_session_id:sessionId,p_redemption_code:code(),p_booking_reference:reference||null,p_event_metadata:{nowbookit_event:safeEvent,attribution:holdAttr}});
      if(error){const m=String(error.message||'');const known=['hold_not_found','hold_not_active','booking_claim_not_available'];const name=known.find(x=>m.includes(x))||'confirm_failed';return json(req,{ok:false,error:name},400)}
      if((data as any)?.ok===false){const name=(data as any)?.error||'confirm_failed';if(name==='hold_expired'&&hold){const offer=await resolveOffer(service,hold.merchant_offer_id,'');if(offer)await logEvent(service,req,offer,'hold_expired',sessionId,{...holdAttr,party_size:hold.party_size,hold_token:token})}return json(req,{ok:false,error:name,capacity_remaining:(data as any)?.capacity_remaining},name==='hold_expired'?409:400)}
      const r=(data as any)?.redemption||{};
      const offer=hold?await resolveOffer(service,hold.merchant_offer_id,''):null;
      if(offer&&!Boolean((data as any)?.reused))await logEvent(service,req,offer,'booking_claim_confirmed',sessionId,{...holdAttr,redemption_id:r.id,party_size:r.party_size,service_date:r.metadata?.service_date,booking_provider:'nowbookit'});
      return json(req,{ok:true,reused:Boolean((data as any)?.reused),redemption:{id:r.id,code:r.redemption_code,status:r.status,party_size:r.party_size,expires_at:r.expires_at,service_date:r.metadata?.service_date,service_start:r.metadata?.service_start,service_end:r.metadata?.service_end,timezone:r.metadata?.timezone||'Australia/Adelaide'},capacity_remaining:(data as any)?.capacity_remaining},201);
    }

    return json(req,{ok:false,error:'unknown_action'},400);
  }catch(e){console.error('perkdrop-booking-claim',e);return json(req,{ok:false,error:'booking_claim_failed'},500)}
});
