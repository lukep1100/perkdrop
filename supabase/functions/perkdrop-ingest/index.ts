import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigin = (origin:string|null) => {
  if (!origin) return true;
  try {
    const u = new URL(origin);
    return u.protocol === "https:" && (u.host === "perkdrop.au" || u.host === "www.perkdrop.au" || (u.host.endsWith(".vercel.app") && u.host.includes("perkdrop")));
  } catch { return false; }
};
const responseHeaders = (origin:string|null) => ({
  "content-type":"application/json; charset=utf-8",
  "access-control-allow-origin": origin && allowedOrigin(origin) ? origin : "https://perkdrop.au",
  "access-control-allow-headers":"authorization, x-client-info, apikey, content-type",
  "access-control-allow-methods":"POST, OPTIONS",
  "vary":"Origin"
});
const clean=(v:unknown,max=4000)=>typeof v === "string" ? v.trim().slice(0,max) : "";
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length<=320;
const httpsOk=(v:string)=>{try{return new URL(v).protocol === "https:"}catch{return false}};
const hashIp=async(ip:string)=>{const salt=Deno.env.get("PERKDROP_HASH_SALT")||"perkdrop";const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${salt}:${ip}`));return Array.from(new Uint8Array(digest)).map(b=>b.toString(16).padStart(2,"0")).join("")};
const numberOrNull=(v:unknown)=>v === "" || v == null ? null : Number(v);

Deno.serve(async(req)=>{
  const origin=req.headers.get("origin");
  const headers=responseHeaders(origin);
  if(req.method==="OPTIONS") return new Response("ok",{headers});
  if(req.method!=="POST") return new Response(JSON.stringify({ok:false,error:"method_not_allowed"}),{status:405,headers});
  if(origin && !allowedOrigin(origin)) return new Response(JSON.stringify({ok:false,error:"origin_not_allowed"}),{status:403,headers});
  const body=await req.json().catch(()=>({}));
  if(clean(body.website,200)) return new Response(JSON.stringify({ok:true}),{headers});
  const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";
  const sourceIpHash=forwarded?await hashIp(forwarded):null;
  const oneHourAgo=new Date(Date.now()-60*60*1000).toISOString();

  if(body.type==="subscribe"){
    const email=clean(body.email,320).toLowerCase();
    if(!emailOk(email)) return new Response(JSON.stringify({ok:false,error:"invalid_email"}),{status:400,headers});
    if(sourceIpHash){
      const {count}=await supabase.from("email_subscribers").select("id",{count:"exact",head:true}).eq("source_ip_hash",sourceIpHash).gte("created_at",oneHourAgo);
      if((count||0)>15) return new Response(JSON.stringify({ok:false,error:"rate_limited"}),{status:429,headers});
    }
    const row={
      email,
      city:clean(body.city,120)||null,
      state:clean(body.state,20)||null,
      interests:Array.isArray(body.interests)?body.interests.map((x:unknown)=>clean(x,60)).filter(Boolean).slice(0,10):[],
      source_page:clean(body.source_page,500)||null,
      utm_source:clean(body.utm_source,120)||null,
      utm_medium:clean(body.utm_medium,120)||null,
      utm_campaign:clean(body.utm_campaign,180)||null,
      source_ip_hash:sourceIpHash,
      status:"subscribed",
      consent_at:new Date().toISOString()
    };
    const {error}=await supabase.from("email_subscribers").upsert(row,{onConflict:"email"});
    if(error) return new Response(JSON.stringify({ok:false,error:"subscribe_failed"}),{status:500,headers});
    return new Response(JSON.stringify({ok:true,status:"subscribed"}),{headers});
  }

  if(body.type==="merchant"){
    if(sourceIpHash){
      const {count}=await supabase.from("merchant_submissions").select("id",{count:"exact",head:true}).eq("source_ip_hash",sourceIpHash).gte("created_at",oneHourAgo);
      if((count||0)>=5) return new Response(JSON.stringify({ok:false,error:"rate_limited"}),{status:429,headers});
    }
    const contactEmail=clean(body.contact_email,320).toLowerCase();
    const bookingUrl=clean(body.booking_url,2000);
    const normalPrice=numberOrNull(body.normal_price);
    const dealPrice=numberOrNull(body.deal_price);
    const row={
      business_name:clean(body.business_name,180),
      contact_name:clean(body.contact_name,180),
      contact_email:contactEmail,
      contact_phone:clean(body.contact_phone,80)||null,
      offer_title:clean(body.offer_title,220),
      description:clean(body.description,4000),
      category:clean(body.category,80)||null,
      normal_price:normalPrice,
      deal_price:dealPrice,
      starts_at:clean(body.starts_at,80)||null,
      ends_at:clean(body.ends_at,80)||null,
      location:clean(body.location,300)||null,
      city:clean(body.city,120)||null,
      state:clean(body.state,20)||null,
      booking_url:bookingUrl,
      promo_code:clean(body.promo_code,100)||null,
      conditions:clean(body.conditions,4000),
      media_url:clean(body.media_url,2000)||null,
      authority_confirmed:body.authority_confirmed===true,
      accuracy_confirmed:body.accuracy_confirmed===true,
      source_ip_hash:sourceIpHash,
      user_agent:clean(req.headers.get("user-agent"),500)||null,
      utm_source:clean(body.utm_source,120)||null,
      utm_medium:clean(body.utm_medium,120)||null,
      utm_campaign:clean(body.utm_campaign,180)||null,
      source_channel:"web_form",
      status:"pending"
    };
    if(!row.business_name||!row.contact_name||!emailOk(contactEmail)||!row.offer_title||row.description.length<10||!httpsOk(bookingUrl)||!row.conditions||!row.authority_confirmed||!row.accuracy_confirmed){
      return new Response(JSON.stringify({ok:false,error:"invalid_submission"}),{status:400,headers});
    }
    if((normalPrice!=null&&(!Number.isFinite(normalPrice)||normalPrice<0))||(dealPrice!=null&&(!Number.isFinite(dealPrice)||dealPrice<0))){
      return new Response(JSON.stringify({ok:false,error:"invalid_price"}),{status:400,headers});
    }
    const {error}=await supabase.from("merchant_submissions").insert(row);
    if(error) return new Response(JSON.stringify({ok:false,error:"submission_failed"}),{status:500,headers});
    return new Response(JSON.stringify({ok:true,status:"pending_review"}),{headers});
  }

  return new Response(JSON.stringify({ok:false,error:"invalid_type"}),{status:400,headers});
});
