import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const headers={'content-type':'application/json','cache-control':'no-store','access-control-allow-origin':'*','access-control-allow-headers':'authorization,apikey,content-type,x-client-info','access-control-allow-methods':'GET,POST,OPTIONS'};
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
        const note=String(body.note||'').trim().slice(0,1000),evidence=String(body.evidence||'').trim().slice(0,1500);
        if(['resolved','dismissed'].includes(body.status)&&(note.length<3||evidence.length<3))return json({ok:false,error:'A reason and evidence reference are required to close a review.'},400);
        const {data:row,error:e}=await sb.from('listing_reports').update({status:body.status,review_note:note,resolution_evidence:evidence||null,reviewed_at:new Date().toISOString(),reviewed_by:data.user.id}).eq('id',body.id).select('id,status').maybeSingle();
        return e||!row?json({ok:false,error:'review_failed'},400):json({ok:true,report:row});
      }
      const {data:rows,error:e}=await sb.from('listing_reports').select('id,catalogue_item_id,merchant_id,reason,category,detail,status,created_at,reviewed_at,review_note,resolution_evidence,merchants:merchant_id(name,slug)').order('created_at',{ascending:false}).limit(100);
      if(e)return json({ok:false,error:'queue_failed'},503);
      const [offers,requests]=await Promise.all([
        sb.from('catalogue_items').select('id,merchant_id,merchant,title,slug,quality_grade,quality_note,availability,last_verified_at,metadata').eq('active',true).order('merchant').limit(1000),
        sb.from('business_requests').select('id,business_name,request_kind,match_state,status,policy_basis,original_request,request_reference,match_basis,commitments_flagged,created_at,resolution_reason,resolution_evidence').order('created_at',{ascending:false}).limit(200)
      ]);
      if(offers.error||requests.error)return json({ok:false,error:'queue_failed'},503);
      const tasks:any[]=[];
      for(const o of offers.data||[]){
        const a=o.availability||{},checked=Date.parse(a.checkedAt||o.last_verified_at||'');
        const add=(category:string,detail:string)=>tasks.push({id:o.id+':'+category,category,merchant:o.merchant,title:o.title,detail,url:'https://perkdrop.au/deals/'+encodeURIComponent(o.slug),source:a.sourceUrl||null});
        if(!Number.isFinite(checked)||checked>Date.now()||Date.now()-checked>30*86400000)add('due_review','A meaningful source review is due; an HTTP 200 check cannot resolve this.');
        if(a.reviewState==='conflicting')add('source_conflict',o.quality_note||'Conflicting source evidence.');
        if(!a.windows?.length)add('missing_service','Exact service windows are not confirmed.');
        if(!['licensed','merchant_authorised'].includes(o.metadata?.image_provenance?.status))add('photo_permission','Offer image reuse rights need confirmation. Directory permission is a separate scope.');
      }
      return json({ok:true,reports:rows,tasks,businessRequests:requests.data,generatedAt:new Date().toISOString(),limits:{offers:1000,reports:100,requests:200}});
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
