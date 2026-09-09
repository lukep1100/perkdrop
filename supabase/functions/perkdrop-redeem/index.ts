import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigin=(origin:string)=>{try{const h=new URL(origin).host;return h==='perkdrop.au'||h==='www.perkdrop.au'||h==='khzpdyyywiucfhubxkev.supabase.co'||(h.endsWith('.vercel.app')&&h.includes('perkdrop'))}catch{return false}};
const cors=(req:Request)=>{const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowedOrigin(o)?o:'https://perkdrop.au','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'}};
const json=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8'}});
const clean=(v:unknown,max=300)=>String(v??'').trim().slice(0,max);
const code=()=>`PD-${crypto.randomUUID().replace(/-/g,'').slice(0,8).toUpperCase()}`;

Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=='POST')return json(req,{ok:false,error:'method_not_allowed'},405);
 const origin=req.headers.get('origin')||'';if(origin&&!allowedOrigin(origin))return json(req,{ok:false,error:'origin_not_allowed'},403);
 try{
  const body=await req.json().catch(()=>null) as any;if(!body||typeof body!=='object')return json(req,{ok:false,error:'invalid_body'},400);
  const dropId=clean(body.drop_id,80),offerId=clean(body.offer_id,80),sessionId=clean(body.session_id,120),partySize=Number(body.party_size??1);
  if(!sessionId||(!dropId&&!offerId))return json(req,{ok:false,error:'missing_required_fields'},400);
  if(!Number.isInteger(partySize)||partySize<1||partySize>20)return json(req,{ok:false,error:'invalid_party_size'},400);
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  let offer:any=null;
  if(offerId){const {data}=await service.from('merchant_offers').select('id,merchant_id,published_drop_id,title,action_type').eq('id',offerId).eq('status','active').maybeSingle();offer=data}
  if(!offer&&dropId){const {data}=await service.from('merchant_offers').select('id,merchant_id,published_drop_id,title,action_type').eq('published_drop_id',dropId).eq('status','active').maybeSingle();offer=data}
  if(!offer)return json(req,{ok:false,error:'redemption_not_available'},404);
  if(offer.action_type==='booking_claim')return json(req,{ok:false,error:'booking_confirmation_required'},409);
  const {data,error}=await service.rpc('claim_merchant_offer',{p_offer_id:offer.id,p_drop_id:dropId||null,p_session_id:sessionId,p_party_size:partySize,p_redemption_code:code()});
  if(error){
    const m=String(error.message||'');
    const known=['invalid_party_size','redemption_not_available','offer_not_started','offer_ended','insufficient_capacity','no_eligible_service','direct_claim_not_allowed','identity_required'];
    const name=known.find(x=>m.includes(x));
    const status=name==='insufficient_capacity'?409:name==='no_eligible_service'?409:400;
    return json(req,{ok:false,error:name||'redeem_failed'},status)
  }
  const result=data as any;const redemption=result.redemption;const meta=redemption?.metadata||{};
  if(!result.reused)try{await service.from('engagement_events').insert({merchant_id:offer.merchant_id,merchant_offer_id:offer.id,catalogue_item_id:offer.published_drop_id||dropId||null,event_type:'redemption_start',session_id:sessionId,metadata:{redemption_id:redemption.id,party_size:redemption.party_size,offer_session_id:meta.offer_session_id||null,service_date:meta.service_date||null}})}catch{}
  return json(req,{ok:true,reused:Boolean(result.reused),redemption:{id:redemption.id,code:redemption.redemption_code,status:redemption.status,expires_at:redemption.expires_at,title:offer.title,merchant_id:offer.merchant_id,party_size:redemption.party_size,offer_session_id:meta.offer_session_id||null,service_date:meta.service_date||null,service_start:meta.service_start||null,service_end:meta.service_end||null,timezone:meta.timezone||null,booking_window_enforced:Boolean(meta.booking_window_enforced)},capacity_remaining:result.capacity_remaining},result.reused?200:201);
 }catch(e){console.error('perkdrop-redeem',e);return json(req,{ok:false,error:'redeem_failed'},500)}
});
