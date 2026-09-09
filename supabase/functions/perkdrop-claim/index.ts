import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const TERMS_VERSION='2026-08-30-v1';
const allowedOrigin=(origin:string)=>{try{const h=new URL(origin).host;return h==='perkdrop.au'||h==='www.perkdrop.au'||h==='khzpdyyywiucfhubxkev.supabase.co'||(h.endsWith('.vercel.app')&&h.includes('perkdrop'))}catch{return false}};
const cors=(req:Request)=>{const origin=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':allowedOrigin(origin)?origin:'https://perkdrop.au','Access-Control-Allow-Headers':'content-type, authorization, apikey','Access-Control-Allow-Methods':'POST, OPTIONS','Vary':'Origin','Cache-Control':'no-store'}};
const json=(req:Request,body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors(req),'Content-Type':'application/json; charset=utf-8'}});
const clean=(v:unknown,max=500)=>String(v??'').trim().slice(0,max);
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const httpsUrl=(v:string)=>{if(!v)return '';try{const u=new URL(v);return u.protocol==='https:'?u.toString().slice(0,1200):''}catch{return ''}};
Deno.serve(async(req)=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:cors(req)});
 if(req.method!=='POST')return json(req,{ok:false,error:'method_not_allowed'},405);
 const origin=req.headers.get('origin')||'';if(origin&&!allowedOrigin(origin))return json(req,{ok:false,error:'origin_not_allowed'},403);
 try{
  const body=await req.json().catch(()=>null) as any;if(!body||typeof body!=='object')return json(req,{ok:false,error:'invalid_body'},400);if(clean(body.website,200))return json(req,{ok:true,received:true},202);
  const auth=req.headers.get('authorization')||'',token=auth.toLowerCase().startsWith('bearer ')?auth.slice(7).trim():'';
  if(!token)return json(req,{ok:false,error:'authentication_required'},401);
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:authData}=await service.auth.getUser(token),userId=authData.user?.id||null,contactEmail=clean(authData.user?.email,254).toLowerCase();
  if(!userId||!emailOk(contactEmail))return json(req,{ok:false,error:'authentication_required'},401);
  const action=clean(body.action,60)||'claim';
  const merchantIdInput=clean(body.merchant_id,80),dropId=clean(body.drop_id,80);
  let merchant:any=null,resolvedDropId:string|null=null;
  if(merchantIdInput){const {data}=await service.from('merchants').select('id,name,slug,listing_status,claimable').eq('id',merchantIdInput).maybeSingle();merchant=data}
  if(!merchant&&dropId){const {data:drop}=await service.from('catalogue_items').select('id,merchant_id').eq('id',dropId).maybeSingle();if(drop?.merchant_id){resolvedDropId=drop.id;const {data}=await service.from('merchants').select('id,name,slug,listing_status,claimable').eq('id',drop.merchant_id).maybeSingle();merchant=data}}
  if(!merchant)return json(req,{ok:false,error:'merchant_not_found'},404);
  const queue=async(eventType:string,payload:any={})=>{try{await service.from('merchant_notification_outbox').insert({merchant_id:merchant.id,event_type:eventType,recipient_email:contactEmail,payload})}catch{}};

  if(action==='ownership_issue'){
    const requestType=['dispute','transfer'].includes(clean(body.request_type,40))?clean(body.request_type,40):'dispute';
    const contactName=clean(body.contact_name,160),reason=clean(body.reason,3000),evidenceUrl=httpsUrl(clean(body.evidence_url,1200));
    if(!contactName||!reason)return json(req,{ok:false,error:'name_and_reason_required'},400);
    const {data,error}=await service.from('merchant_ownership_requests').insert({merchant_id:merchant.id,user_id:userId,request_type:requestType,contact_name:contactName,contact_email:contactEmail,reason,evidence_url:evidenceUrl||null,status:'pending'}).select('id,status').single();
    if(error){console.error('ownership request',error);return json(req,{ok:false,error:'ownership_request_failed'},500)}
    await queue('ownership_request_received',{request_id:data.id,request_type:requestType,merchant_name:merchant.name});
    return json(req,{ok:true,received:true,request_id:data.id,status:data.status},201);
  }

  const contactName=clean(body.contact_name,160),contactPhone=clean(body.contact_phone,80),businessRole=clean(body.business_role,120),evidenceUrl=httpsUrl(clean(body.evidence_url,1200)),evidenceNotes=clean(body.evidence_notes,1800);
  if(!contactName)return json(req,{ok:false,error:'missing_required_fields'},400);
  if(body.terms_accepted!==true||body.privacy_acknowledged!==true)return json(req,{ok:false,error:'merchant_terms_and_privacy_required'},400);
  if(['claim_pending','claimed','verified','partner'].includes(merchant.listing_status)||!merchant.claimable)return json(req,{ok:false,error:merchant.listing_status==='claim_pending'?'claim_already_pending':'listing_not_claimable'},409);
  const acceptedAt=new Date().toISOString();
  const {data:claim,error}=await service.from('merchant_claims').insert({merchant_id:merchant.id,drop_id:resolvedDropId||dropId||null,user_id:userId,contact_name:contactName,contact_email:contactEmail,contact_phone:contactPhone||null,business_role:businessRole||null,evidence_url:evidenceUrl||null,evidence_notes:evidenceNotes||null,status:'pending',source_channel:'merchant_portal',terms_version:TERMS_VERSION,terms_accepted_at:acceptedAt,metadata:{merchant_name:merchant.name,privacy_acknowledged_at:acceptedAt}}).select('id').single();
  if(error){console.error('perkdrop-claim insert',error);return json(req,{ok:false,error:'claim_save_failed'},500)}
  await service.from('merchants').update({listing_status:'claim_pending',claimable:false}).eq('id',merchant.id).eq('listing_status','unclaimed');
  try{await service.from('engagement_events').insert({merchant_id:merchant.id,catalogue_item_id:resolvedDropId||dropId||null,event_type:'claim_submit',source_page:clean(body.source_page,500)||'/claim',metadata:{claim_id:claim.id}})}catch{}
  await queue('claim_received',{claim_id:claim.id,merchant_name:merchant.name,terms_version:TERMS_VERSION});
  return json(req,{ok:true,received:true,claim_id:claim.id,merchant:{id:merchant.id,name:merchant.name,status:'claim_pending'}},201);
 }catch(e){console.error('perkdrop-claim',e);return json(req,{ok:false,error:'claim_failed'},500)}
});
