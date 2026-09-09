import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const hashIp=async(ip:string)=>{const salt=Deno.env.get('PERKDROP_HASH_SALT')||'perkdrop';const d=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${salt}:${ip}`));return Array.from(new Uint8Array(d)).map(b=>b.toString(16).padStart(2,'0')).join('')};
const validCoord=(n:number,min:number,max:number)=>Number.isFinite(n)&&n>=min&&n<=max;

Deno.serve(async(req)=>{
  if(req.method!=='GET')return new Response('Method not allowed',{status:405});
  try{
    const url=new URL(req.url);const dropId=(url.searchParams.get('drop')||'').trim();if(!/^PD-\d{4}-\d{4}$/.test(dropId))return Response.redirect('https://perkdrop.au/map',302);
    const service=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:deal}=await service.from('catalogue_items').select('id,merchant_id,merchant,city,location,latitude,longitude,active').eq('id',dropId).eq('active',true).maybeSingle();if(!deal)return Response.redirect('https://perkdrop.au/map',302);
    const lat=Number(url.searchParams.get('lat')),lng=Number(url.searchParams.get('lng'));const location=(url.searchParams.get('loc')||deal.location||deal.merchant||'').slice(0,500);
    const destination=validCoord(lat,-90,90)&&validCoord(lng,-180,180)?`${lat},${lng}`:(validCoord(Number(deal.latitude),-90,90)&&validCoord(Number(deal.longitude),-180,180)?`${deal.latitude},${deal.longitude}`:location);
    const target=`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}`;
    const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()||'';let sourceIpHash:string|null=null;try{sourceIpHash=forwarded?await hashIp(forwarded):null}catch{}
    try{await service.from('engagement_events').insert({merchant_id:deal.merchant_id,catalogue_item_id:deal.id,event_type:'directions',city:deal.city||null,source_page:(url.searchParams.get('from')||'detail').slice(0,500),referrer:(req.headers.get('referer')||'').slice(0,1000)||null,source_ip_hash:sourceIpHash,user_agent:(req.headers.get('user-agent')||'').slice(0,300)||null,metadata:{destination}})}catch{}
    return Response.redirect(target,302);
  }catch(e){console.error('perkdrop-nav',e);return Response.redirect('https://perkdrop.au/map',302)}
});
