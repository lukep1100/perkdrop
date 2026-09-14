import "jsr:@supabase/functions-js@2.4.4/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const esc=(v:unknown)=>String(v??'').replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]||c));
const clean=(v:unknown,n=500)=>String(v??'').trim().slice(0,n);
const providerLabel=(v:unknown)=>clean(v,80).replace(/[_-]+/g,' ').replace(/\b\w/g,x=>x.toUpperCase());
const subjectFor=(event:string,p:any)=>{
 const title=clean(p?.title||p?.offer_title||'',120),merchant=clean(p?.merchant_name||p?.business_name||'',120),provider=providerLabel(p?.provider)||'booking provider';
 const map:Record<string,string>={
  public_drop_submission_received:`PerkDrop received ${title||'your Drop'}`,
  claim_approved:`${merchant||'Your business'} is verified on PerkDrop`,
  claim_rejected:`PerkDrop business claim update`,
  drop_submitted:`PerkDrop received ${title||'your Drop'}`,
  drop_approved:`${title||'Your Drop'} is live on PerkDrop`,
  drop_rejected:`PerkDrop review update for ${title||'your Drop'}`,
  drop_paused:`${title||'Your Drop'} is paused`,
  profile_updated:`${merchant||'Your business'} profile was updated`,
  profile_change_received:`PerkDrop received your verified-detail change`,
  profile_change_approved:`PerkDrop approved your verified-detail change`,
  profile_change_rejected:`PerkDrop verified-detail change update`,
  ownership_request_received:`PerkDrop received your ownership request`,
  ownership_request_reviewing:`PerkDrop is reviewing your ownership request`,
  ownership_transfer_approved:`PerkDrop ownership transfer approved`,
  ownership_request_resolved:`PerkDrop ownership request resolved`,
  ownership_request_rejected:`PerkDrop ownership request update`,
  booking_provider_request_received:`PerkDrop received your ${provider} connection request`,
  booking_provider_request_cancelled:`Your ${provider} connection request was cancelled`,
  booking_provider_status:`PerkDrop ${provider} connection update`,
  booking_provider_activated:`${provider} is connected to PerkDrop`,
  watch_match:`PerkDrop Radar: ${title||'a new Drop matched your watch'}`
 };
 return map[event]||'PerkDrop update';
};
const businessBody=(event:string,p:any)=>{
 const merchant=clean(p?.merchant_name||p?.business_name||'your business',160),title=clean(p?.title||p?.offer_title||'your Drop',180),url=clean(p?.detail_url||'',800),provider=providerLabel(p?.provider)||'your booking provider',status=clean(p?.status,80).replace(/_/g,' '),notes=clean(p?.admin_notes||p?.notes||'',1000);
 const lines:Record<string,string[]>={
  public_drop_submission_received:[`We received ${title} from ${merchant}.`,`PerkDrop will review the details before anything is published.`],
  claim_approved:[`Your request to manage ${merchant} on PerkDrop has been approved.`,`Log in with your own account: https://perkdrop.au/claim`,`Review the listing and supported profile controls. You do not need to create another offer.`],
  claim_rejected:[`We could not verify the business claim with the information supplied.`,`Reply to your PerkDrop contact if you have additional verification evidence.`],
  drop_submitted:[`We received ${title}.`,`It will stay pending until PerkDrop completes its review.`],
  drop_approved:[`${title} has been approved and published.`,url?`Live page: https://perkdrop.au${url}`:''],
  drop_rejected:[`${title} was not approved for publication.`,clean(p?.reason||'',1000)],
  drop_paused:[`${title} has been paused.`,`Customers will not be able to claim new capacity while it is paused.`],
  profile_updated:[`${merchant}'s public PerkDrop profile was updated.`],
  profile_change_received:[`We received your request to change verified business details.`,`PerkDrop will review it before protected details change.`],
  profile_change_approved:[`Your verified business detail change was approved.`],
  profile_change_rejected:[`Your verified business detail change was not approved.`,clean(p?.reason||'',1000)],
  ownership_request_received:[`We received your ownership/access request for ${merchant}.`],
  ownership_request_reviewing:[`PerkDrop is reviewing the ownership/access request for ${merchant}.`],
  ownership_transfer_approved:[`The ownership transfer for ${merchant} was approved.`],
  ownership_request_resolved:[`The ownership/access request for ${merchant} has been resolved.`],
  ownership_request_rejected:[`The ownership/access request for ${merchant} was not approved.`,clean(p?.reason||'',1000)],
  booking_provider_request_received:[`We received your request to connect ${provider} to PerkDrop.`,`Your current booking flow stays unchanged until the connection is tested and activated.`],
  booking_provider_request_cancelled:[`Your request to connect ${provider} was cancelled.`],
  booking_provider_status:[`Your ${provider} connection is now ${status||'being reviewed'}.`,notes],
  booking_provider_activated:[`${provider} is now connected for the capabilities PerkDrop has verified.`,`PerkDrop will only use native booking capabilities that are explicitly active for your account.`]
 };
 return `${(lines[event]||[`There is an update for ${merchant} on PerkDrop.`]).filter(Boolean).join('\n\n')}\n\nPerkDrop\nhttps://perkdrop.au\n\nCommercial fees apply only where separately agreed.`;
};
const htmlFor=(subject:string,text:string)=>`<div style="font-family:Arial,sans-serif;line-height:1.55;color:#17131c"><div style="font-size:24px;font-weight:800">Perk<span style="color:#cc2aa5">Drop</span></div><h2>${esc(subject)}</h2>${text.split('\n\n').map(x=>`<p>${esc(x).replace(/\n/g,'<br>')}</p>`).join('')}</div>`;

import { dispatchMerchantBatch } from "./worker.ts";

Deno.serve(async(req)=>{
 if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
 try{
  const url=Deno.env.get('SUPABASE_URL')||'',key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
  if(!url||!key)return json({ok:false,error:'server_not_configured'},500);
  const sb=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:cfg,error}=await sb.from('merchant_notification_config').select('*').eq('singleton',true).maybeSingle();
  if(error||!cfg)return json({ok:false,error:'notification_config_missing'},500);
  const supplied=req.headers.get('x-perkdrop-notification-secret')||'';
  if(!supplied||supplied!==cfg.dispatch_secret)return json({ok:false,error:'unauthorized'},401);
  if(!cfg.enabled)return json({ok:true,enabled:false,processed:0});
  if(!cfg.release_after||!cfg.released_event_types?.length)return json({ok:true,enabled:true,release_held:true,processed:0});
  if(cfg.provider!=='resend')return json({ok:false,error:'unsupported_provider'},503);
  const apiKey=Deno.env.get('RESEND_API_KEY')||'',from=clean(cfg.from_email,254),fromName=clean(cfg.from_name||'PerkDrop',120);
  if(!apiKey||!from)return json({ok:false,error:'email_provider_not_configured'},503);
  const result=await dispatchMerchantBatch(sb,apiKey,Math.min(20,Number(cfg.batch_size)||20),(row:any)=>{
    const subject=subjectFor(row.event_type,row.payload||{}),text=businessBody(row.event_type,row.payload||{});
    return {from:`${fromName} <${from}>`,to:[row.recipient_email],subject,text,html:htmlFor(subject,text)};
  });
  return json({ok:true,enabled:true,...result,consumer_dispatch:'held_separate_release_required'});
 }catch{
  // Never log credentials, recipient bodies, provider responses or verification links.
  return json({ok:false,error:'notification_dispatch_failed'},500);
 }
});
