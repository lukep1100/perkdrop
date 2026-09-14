import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,content-type','access-control-allow-methods':'GET,POST,OPTIONS'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
  if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
  if(!['GET','POST'].includes(req.method))return json({ok:false,error:'method_not_allowed'},405);
  try{
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    if(Number(req.headers.get('content-length')||0)>4096)return json({ok:false,error:'report_too_large'},413);
    const raw=req.method==='POST'?await req.text():'';
    if(raw.length>4096)return json({ok:false,error:'report_too_large'},413);
    const body=raw?JSON.parse(raw):{};
    if(req.method==='GET'||body.action==='review'){
      const token=(req.headers.get('authorization')||'').replace(/^Bearer /i,'');
      if(!token)return json({ok:false,error:'sign_in_required'},401);
      const {data,error}=await sb.auth.getUser(token);
      if(error||!data.user?.email_confirmed_at||data.user.email?.toLowerCase()!=='perkdropofficial@gmail.com')return json({ok:false,error:'staff_required'},403);
      if(body.action==='review'){
        if(!['reviewing','resolved','dismissed'].includes(body.status))return json({ok:false,error:'invalid_status'},400);
        const {data:row,error:e}=await sb.from('listing_reports').update({status:body.status,review_note:String(body.note||'').slice(0,1000),reviewed_at:new Date().toISOString(),reviewed_by:data.user.id}).eq('id',body.id).select('id,status').maybeSingle();
        return e||!row?json({ok:false,error:'review_failed'},400):json({ok:true,report:row});
      }
      const {data:rows,error:e}=await sb.from('listing_reports').select('id,catalogue_item_id,merchant_id,reason,detail,status,created_at,reviewed_at,review_note,merchants:merchant_id(name,slug)').in('status',['pending','reviewing']).order('created_at',{ascending:false}).limit(100);
      return e?json({ok:false,error:'queue_failed'},503):json({ok:true,reports:rows});
    }
    if(body.action&&body.action!=='submit')return json({ok:false,error:'invalid_action'},400);
    if(body.website)return json({ok:true,status:'received'}); // Honeypot; no side effects.
    // Gateway IP is never persisted. Salt with the server-only service secret.
    const ip=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if(!ip)return json({ok:false,error:'report_unavailable'},503);
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}:${ip}`));
    const hash=Array.from(new Uint8Array(digest),x=>x.toString(16).padStart(2,'0')).join('');
    const {data,error}=await sb.rpc('submit_listing_report',{p_drop:body.drop||null,p_merchant:body.merchant||null,p_reason:body.reason,p_detail:typeof body.detail==='string'?body.detail.trim():'',p_hash:hash});
    if(error)return json({ok:false,error:error.message.includes('rate_limit')?'Too many reports. Please try again in an hour.':'Could not submit this report. Check the listing and try again.'},error.message.includes('rate_limit')?429:400);
    return json({ok:true,id:data,status:'pending_review'});
  }catch{return json({ok:false,error:'invalid_request'},400);}
});
