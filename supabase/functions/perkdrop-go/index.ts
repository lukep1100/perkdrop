import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedHost=(host:string)=>host==="perkdrop.au"||host==="www.perkdrop.au"||(host.endsWith(".vercel.app")&&host.includes("perkdrop"));
const hashIp=async(ip:string)=>{const salt=Deno.env.get("PERKDROP_HASH_SALT")||"perkdrop";const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${salt}:${ip}`));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")};

Deno.serve(async(req)=>{
  try{
    if(req.method!=="GET") return new Response("Method not allowed",{status:405});
    const url=new URL(req.url);const dropId=(url.searchParams.get("drop")||"").trim();if(!/^PD-\d{4}-\d{4}$/.test(dropId)) return new Response("Invalid Drop",{status:400});
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const {data:deal,error}=await supabase.from("catalogue_items").select("id,merchant_id,merchant,source,city,category,active,metadata,offer_origin,detail_url").eq("id",dropId).eq("active",true).maybeSingle();
    if(error||!deal) return Response.redirect("https://perkdrop.au/deals",302);
    const ref=req.headers.get("referer")||"";const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";let sourceIpHash:string|null=null;try{sourceIpHash=forwarded?await hashIp(forwarded):null}catch{}
    const sourcePage=(url.searchParams.get("from")||"").slice(0,500);const sessionId=(url.searchParams.get("sid")||"").slice(0,120)||null;
    const merchantOfferId=typeof deal.metadata?.merchant_offer_id==='string'?deal.metadata.merchant_offer_id:'';
    if(merchantOfferId){
      const {data:activeOffer}=await supabase.from('merchant_offers').select('id,status').eq('id',merchantOfferId).eq('merchant_id',deal.merchant_id).eq('status','active').maybeSingle();
      if(activeOffer){
        const claimUrl=`https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-consumer-claim?drop=${encodeURIComponent(deal.id)}`;
        try{await Promise.all([
          supabase.from("outbound_clicks").insert({drop_id:deal.id,merchant_id:deal.merchant_id||null,merchant:deal.merchant||null,destination_url:claimUrl,source_page:sourcePage||null,city:deal.city||null,category:deal.category||null,session_id:sessionId,referrer:ref.slice(0,1000)||null,utm_source:url.searchParams.get("utm_source")?.slice(0,120)||null,utm_medium:url.searchParams.get("utm_medium")?.slice(0,120)||null,utm_campaign:url.searchParams.get("utm_campaign")?.slice(0,180)||null,device_hint:(req.headers.get("sec-ch-ua-mobile")||req.headers.get("user-agent")||"").slice(0,300),source_ip_hash:sourceIpHash}),
          supabase.from('engagement_events').insert({merchant_id:deal.merchant_id||null,catalogue_item_id:deal.id,merchant_offer_id:activeOffer.id,event_type:'redemption_page_open',session_id:sessionId,city:deal.city||null,source_page:sourcePage||'detail',referrer:ref.slice(0,1000)||null,source_ip_hash:sourceIpHash,user_agent:(req.headers.get('user-agent')||'').slice(0,300)||null,metadata:{destination_host:'khzpdyyywiucfhubxkev.supabase.co'}})
        ])}catch{}
        return Response.redirect(claimUrl,302);
      }
    }
    const original=typeof deal.metadata?.original_go_url==="string"?deal.metadata.original_go_url:"";const fallback=typeof deal.source==="string"&&!deal.source.includes("/functions/v1/perkdrop-go")?deal.source:"";
    let target:URL;try{target=new URL(original||fallback)}catch{return Response.redirect("https://perkdrop.au/deals",302)}if(target.protocol!=="https:") return Response.redirect("https://perkdrop.au/deals",302);
    try{if(ref&&!allowedHost(new URL(ref).host)) return Response.redirect(target.toString(),302)}catch{}
    try{
      await Promise.all([
        supabase.from("outbound_clicks").insert({drop_id:deal.id,merchant_id:deal.merchant_id||null,merchant:deal.merchant||null,destination_url:target.toString(),source_page:sourcePage||null,city:deal.city||null,category:deal.category||null,session_id:sessionId,referrer:ref.slice(0,1000)||null,utm_source:url.searchParams.get("utm_source")?.slice(0,120)||null,utm_medium:url.searchParams.get("utm_medium")?.slice(0,120)||null,utm_campaign:url.searchParams.get("utm_campaign")?.slice(0,180)||null,device_hint:(req.headers.get("sec-ch-ua-mobile")||req.headers.get("user-agent")||"").slice(0,300),source_ip_hash:sourceIpHash}),
        supabase.from('engagement_events').insert({merchant_id:deal.merchant_id||null,catalogue_item_id:deal.id,event_type:'website_click',session_id:sessionId,city:deal.city||null,source_page:sourcePage||'detail',referrer:ref.slice(0,1000)||null,source_ip_hash:sourceIpHash,user_agent:(req.headers.get('user-agent')||'').slice(0,300)||null,metadata:{destination_host:target.host}})
      ]);
    }catch{}
    return Response.redirect(target.toString(),302);
  }catch(e){console.error("perkdrop-go",e);return Response.redirect("https://perkdrop.au/deals",302)}
});


