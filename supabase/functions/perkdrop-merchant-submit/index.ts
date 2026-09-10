import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const TERMS_VERSION='2026-08-30-v1';
const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"content-type","Access-Control-Allow-Methods":"POST,OPTIONS","Cache-Control":"no-store"};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const clean=(v:unknown,max=500)=>String(v??"").trim().slice(0,max);
const emailOk=(v:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)&&v.length<=254;
const httpsUrl=(v:string)=>{if(!v)return "";try{const u=new URL(v);return u.protocol==="https:"?u.toString().slice(0,1200):""}catch{return ""}};
const hashIp=async(ip:string)=>{const salt=Deno.env.get("PERKDROP_HASH_SALT")||"perkdrop";const d=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${salt}:${ip}`));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,"0")).join("")};
const slugify=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,90)||'business';
const verticals=['food','beauty','experiences','events','shopping','family_kids','fitness','travel_stays','freebies','services'];
const fulfilmentModes=['direct_claim','external_booking','ticket','appointment','merchant_confirmation','information_only'];
const inventoryUnits=['person','appointment','ticket','class_spot','room','item','booking'];
const dropTypes=['capacity','last_minute','cancellation'];
const discountTypes=['value_add','percent','fixed','free'];

Deno.serve(async(req)=>{
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers:CORS});
  if(req.method!=="POST") return json({ok:false,error:"Method not allowed"},405);
  try{
    const ct=req.headers.get("content-type")||"";if(!ct.includes("application/json")) return json({ok:false,error:"JSON required"},415);
    const body=await req.json().catch(()=>null) as any;if(!body||typeof body!=="object") return json({ok:false,error:"Invalid submission"},400);
    if(clean(body.website,200)) return json({ok:true,received:true},202);

    const business_name=clean(body.business_name,160),contact_name=clean(body.contact_name,160),contact_email=clean(body.contact_email,254).toLowerCase(),contact_phone=clean(body.contact_phone,80);
    const offer_title=clean(body.offer_title,180),description=clean(body.description,2500),category=clean(body.category,80),location=clean(body.location,300),city=clean(body.city,100)||"Adelaide",state=clean(body.state,60)||"SA";
    const promo_code=clean(body.promo_code,100),conditions=clean(body.conditions,1800),booking_url=httpsUrl(clean(body.booking_url,1200)),media_url=httpsUrl(clean(body.media_url,1200));
    const vertical=verticals.includes(clean(body.vertical,40))?clean(body.vertical,40):'food',fulfilment_mode=fulfilmentModes.includes(clean(body.fulfilment_mode,40))?clean(body.fulfilment_mode,40):'external_booking',inventory_unit=inventoryUnits.includes(clean(body.inventory_unit,40))?clean(body.inventory_unit,40):'person',drop_type=dropTypes.includes(clean(body.drop_type,40))?clean(body.drop_type,40):'capacity',discount_type=discountTypes.includes(clean(body.discount_type,40))?clean(body.discount_type,40):'value_add';
    const authority_confirmed=body.authority_confirmed===true,accuracy_confirmed=body.accuracy_confirmed===true,exclusive_requested=body.exclusive_requested===true;
    const termsAccepted=body.terms_accepted===true,termsAcceptedAt=termsAccepted?new Date().toISOString():null;
    const commercial_model_requested=clean(body.commercial_model_requested,80)||null;
    if(!business_name||!contact_name||!emailOk(contact_email)||!contact_phone||!offer_title||!description||!location||conditions.length<12) return json({ok:false,error:"Please complete the required fields and conditions."},400);
    if(!authority_confirmed||!accuracy_confirmed||!termsAccepted) return json({ok:false,error:"Authority, accuracy and merchant-terms confirmations are required."},400);
    const num=(v:unknown)=>{if(v===null||v===""||v===undefined)return null;const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=1000000?n:null};
    const date=(v:unknown)=>{const s=clean(v,80);if(!s)return null;const d=new Date(s);return Number.isNaN(d.getTime())?null:d.toISOString()};
    const forwarded=req.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||"";let source_ip_hash:string|null=null;try{source_ip_hash=forwarded?await hashIp(forwarded):null}catch{}
    const supabase=createClient(Deno.env.get("SUPABASE_URL")!,Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    let merchant:any=null;
    const {data:exact}=await supabase.from('merchants').select('id,name,listing_status').eq('name',business_name).limit(1).maybeSingle();merchant=exact;
    if(!merchant){
      const suffix=crypto.randomUUID().replace(/-/g,'').slice(0,6);
      const {data,error}=await supabase.from('merchants').insert({name:business_name,slug:`${slugify(business_name)}-${suffix}`,listing_status:'unclaimed',primary_city:city.toLowerCase().replace(/\s+/g,'-'),primary_state:state,primary_location:location}).select('id,name,listing_status').single();
      if(error){console.error('merchant create',error);return json({ok:false,error:'Business profile could not be created.'},500)}merchant=data;
    }

    const starts=date(body.starts_at),ends=date(body.ends_at),normal=num(body.normal_price),deal=num(body.deal_price),capacity=Math.floor(Number(body.capacity_total));
    if(!starts||!ends||new Date(ends)<=new Date(starts)||!Number.isInteger(capacity)||capacity<1||capacity>10000) return json({ok:false,error:'Add a valid capacity and offer window.'},400);
    let discountPercent:number|null=null;if(normal!==null&&deal!==null&&normal>0&&deal<=normal)discountPercent=Math.round(((normal-deal)/normal)*10000)/100;
    const {data:offer,error:offerError}=await supabase.from('merchant_offers').insert({merchant_id:merchant.id,title:offer_title,description,category:category||vertical,vertical,drop_type,inventory_unit,fulfilment_mode,discount_type,discount_percent:discountPercent,normal_price:normal,deal_price:deal,promo_code:promo_code||null,conditions,starts_at:starts,ends_at:ends,capacity_total:capacity,capacity_remaining:capacity,location,city:city.toLowerCase().replace(/\s+/g,'-'),state,booking_url:booking_url||null,media_url:media_url||null,exclusive:exclusive_requested,status:'pending',metadata:{submission_source:'public_business_form',redemption_verifier:clean(body.redemption_verifier,160),commercial_model:'$3_per_confirmed_guest',media_rights_confirmed:false}}).select('id').single();
    if(offerError){console.error('offer create',offerError);return json({ok:false,error:'Offer could not be saved. Please try again.'},500)}

    const {data,error}=await supabase.from("merchant_submissions").insert({
      status:"pending",merchant_id:merchant.id,merchant_offer_id:offer.id,business_name,contact_name,contact_email,contact_phone:contact_phone||null,offer_title,description,normal_price:normal,deal_price:deal,starts_at:starts,ends_at:ends,location,city,state,booking_url:booking_url||'',promo_code:promo_code||null,conditions,media_url:media_url||null,authority_confirmed,accuracy_confirmed,source_ip_hash,user_agent:clean(req.headers.get("user-agent"),300)||null,utm_source:clean(body.utm_source,120)||null,utm_medium:clean(body.utm_medium,120)||null,utm_campaign:clean(body.utm_campaign,180)||null,category:category||null,source_channel:"web_form",exclusive_requested,commercial_model_requested,terms_version:termsAccepted?TERMS_VERSION:null,terms_accepted_at:termsAcceptedAt
      }).select("id").single();
    if(error){console.error("merchant submission insert",error);await supabase.from('merchant_offers').delete().eq('id',offer.id);return json({ok:false,error:"Submission could not be saved. Please try again."},500)}
    try{await supabase.from('merchant_notification_outbox').insert({merchant_id:merchant.id,event_type:'public_drop_submission_received',recipient_email:contact_email,payload:{submission_id:data.id,offer_id:offer.id,business_name,offer_title}})}catch{}
    return json({ok:true,received:true,id:data.id,merchant_id:merchant.id,offer_id:offer.id},201);
  }catch(e){console.error("perkdrop-merchant-submit",e);return json({ok:false,error:"Submission could not be saved. Please try again."},500)}
});
