import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const events=new Set(["deal_open","search","save_toggle","map_open","directions_click","official_deal_click","business_submit_started","business_submit_completed","claim_portal_open","page_view"]);
const canonical:Record<string,string>={deal_open:'deal_view',save_toggle:'save',directions_click:'directions',official_deal_click:'website_click'};
const originOk=(v:string)=>{try{const h=new URL(v).host;return h==="perkdrop.au"||h==="www.perkdrop.au"||(h.includes("perkdrop")&&h.endsWith(".vercel.app"))}catch{return false}};
const clean=(v:unknown,n:number)=>typeof v==="string"?v.trim().slice(0,n):"";
const headers=(req:Request)=>{const o=req.headers.get("origin")||"";return {"Access-Control-Allow-Origin":originOk(o)?o:"https://perkdrop.au","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store","Vary":"Origin"}};
const reply=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...headers(req),"content-type":"application/json"}});
const hash=async(v:string)=>{const raw=`${Deno.env.get("PERKDROP_HASH_SALT")||"perkdrop"}:${v}`;const bytes=new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(raw)));return Array.from(bytes).map(x=>x.toString(16).padStart(2,"0")).join("")};

Deno.serve(async req=>{
  if(req.method==="OPTIONS")return new Response(null,{status:204,headers:headers(req)});
  if(req.method!=="POST")return reply(req,{ok:false,error:'method_not_allowed'},405);
  if(Number(req.headers.get("content-length")||0)>4096)return reply(req,{ok:false,error:'payload_too_large'},413);
  if(req.headers.get("origin")&&!originOk(req.headers.get("origin")||""))return reply(req,{ok:false,error:'origin_not_allowed'},403);
  try{
    const b=await req.json(),inputEvent=clean(b?.event_type,40);
    if(!events.has(inputEvent))return reply(req,{ok:false,error:'invalid_event'},400);
    const event=canonical[inputEvent]||inputEvent;
    const ip=(req.headers.get("x-forwarded-for")||req.headers.get('cf-connecting-ip')||"").split(",")[0].trim();
    if(!ip)return reply(req,{ok:false,error:'missing_client_ip'},429);
    const ipHash=await hash(ip),service=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const since=new Date(Date.now()-60000).toISOString();
    const {count}=await service.from("engagement_events").select("id",{count:"exact",head:true}).eq("source_ip_hash",ipHash).gte("created_at",since);
    if((count||0)>=60)return reply(req,{ok:false,error:'rate_limited'},429);
    const m=b.metadata&&typeof b.metadata==="object"&&!Array.isArray(b.metadata)?b.metadata:{};
    const metadata={path:clean(m.path,300)||null,deal_slug:clean(m.deal_slug,160)||null,merchant:clean(m.merchant,160)||null,category:clean(m.category,80)||null,search_term:clean(m.search_term,80)||null,saved_state:typeof m.saved_state==="boolean"?m.saved_state:null,utm_source:clean(m.utm_source,40)||null,utm_medium:clean(m.utm_medium,40)||null,utm_campaign:clean(m.utm_campaign,100)||null,source_event:inputEvent};
    const requestedDropId=clean(m.deal_id,80)||null;
    let dropId:string|null=null,merchantId:string|null=null,merchantOfferId:string|null=null;
    if(requestedDropId){
      const {data:drop}=await service.from('catalogue_items').select('id,merchant_id,metadata').eq('id',requestedDropId).maybeSingle();
      if(drop){dropId=drop.id;merchantId=drop.merchant_id||null;const mo=clean(drop.metadata?.merchant_offer_id,80);merchantOfferId=mo||null}
    }
    const {error}=await service.from("engagement_events").insert({merchant_id:merchantId,merchant_offer_id:merchantOfferId,catalogue_item_id:dropId,event_type:event,session_id:clean(b.session_id,120)||null,city:clean(b.city,100)||null,source_page:clean(b.source_page,300)||null,source_ip_hash:ipHash,metadata});
    if(error)throw error;
    return reply(req,{ok:true},202);
  }catch(e){console.error("perkdrop-track",e);return reply(req,{ok:false,error:'track_failed'},500)}
});


