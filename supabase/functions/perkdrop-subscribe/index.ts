import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const originOk=(v:string)=>{try{const h=new URL(v).host;return h==='perkdrop.au'||h==='www.perkdrop.au'||h==='khzpdyyywiucfhubxkev.supabase.co'||(h.includes('perkdrop')&&h.endsWith('.vercel.app'))}catch{return false}};
const clean=(v:unknown,n:number)=>String(v??'').trim().slice(0,n);
const headers=(req:Request)=>{const o=req.headers.get('origin')||'';return {'Access-Control-Allow-Origin':originOk(o)?o:'https://perkdrop.au','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,OPTIONS','Cache-Control':'no-store','Vary':'Origin'}};
const reply=(req:Request,b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:{...headers(req),'content-type':'application/json; charset=utf-8'}});
const hash=async(v:string)=>{const raw=`${Deno.env.get('PERKDROP_HASH_SALT')||'perkdrop'}:${v}`;const bytes=new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)));return Array.from(bytes).map(x=>x.toString(16).padStart(2,'0')).join('')};
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:headers(req)});
 if(req.method!=='POST')return reply(req,{ok:false,error:'method_not_allowed'},405);
 const origin=req.headers.get('origin')||'';if(origin&&!originOk(origin))return reply(req,{ok:false,error:'origin_not_allowed'},403);
 try{
  const b=await req.json();const email=clean(b?.email,320).toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))return reply(req,{ok:false,error:'invalid_email'},400);
  if(b?.consent!==true)return reply(req,{ok:false,error:'consent_required'},400);
  const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'').split(',')[0].trim();const ipHash=ip?await hash(ip):null;
  const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  if(ipHash){const since=new Date(Date.now()-3600000).toISOString();const {count}=await service.from('email_subscribers').select('id',{count:'exact',head:true}).eq('source_ip_hash',ipHash).gte('consent_at',since);if((count||0)>=10)return reply(req,{ok:false,error:'rate_limited'},429)}
  const row={email,city:'Adelaide',state:'SA',interests:['food','experiences','last-minute'],status:'subscribed',consent_at:new Date().toISOString(),source_page:clean(b?.source_page,500)||'/deals/union-hotel-20-off-lunch',utm_source:clean(b?.utm_source,60)||null,utm_medium:clean(b?.utm_medium,60)||null,utm_campaign:clean(b?.utm_campaign,140)||null,source_ip_hash:ipHash};
  const {error}=await service.from('email_subscribers').upsert(row,{onConflict:'email'});if(error)throw error;
  return reply(req,{ok:true},201);
 }catch(e){console.error('perkdrop-subscribe',e);return reply(req,{ok:false,error:'subscribe_failed'},500)}
});
