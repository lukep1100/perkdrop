import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const H={"content-type":"application/json; charset=utf-8","access-control-allow-origin":"*","access-control-allow-methods":"GET, OPTIONS","cache-control":"private, max-age=15"};
const j=(b:unknown,s=200)=>new Response(JSON.stringify(b),{status:s,headers:H});
const valid=(n:number,min:number,max:number)=>Number.isFinite(n)&&n>=min&&n<=max;

Deno.serve(async(req)=>{
  if(req.method==='OPTIONS')return new Response('ok',{headers:H});
  if(req.method!=='GET')return j({ok:false,error:'method_not_allowed'},405);
  try{
    const u=new URL(req.url);const lat=Number(u.searchParams.get('lat')),lng=Number(u.searchParams.get('lng'));const radius=Math.min(200,Math.max(1,Number(u.searchParams.get('radius_km')||50)||50));
    const limit=Math.min(200,Math.max(1,Number(u.searchParams.get('limit')||100)||100));
    if(!valid(lat,-90,90)||!valid(lng,-180,180))return j({ok:false,error:'valid_lat_lng_required'},400);
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:near,error}=await sb.rpc('perkdrop_nearby_drop_ids',{p_lat:lat,p_lng:lng,p_radius_km:radius});
    if(error){console.error(error);return j({ok:false,error:'nearby_query_failed'},500)}
    const ordered=(near||[]).slice(0,limit);const ids=ordered.map((x:any)=>x.id);if(!ids.length)return j({ok:true,mode:'nearby',radiusKm:radius,count:0,deals:[]});
    const base=Deno.env.get('SUPABASE_URL')+'/functions/v1/perkdrop-catalogue-api?limit=200';
    const r=await fetch(base,{headers:{accept:'application/json'}});if(!r.ok)return j({ok:false,error:'catalogue_unavailable'},502);const cat=await r.json();
    const byId=new Map((cat.deals||[]).map((d:any)=>[d.id,d]));const dist=new Map(ordered.map((x:any)=>[x.id,Number(x.distance_km)]));
    const deals=ids.map((id:string)=>byId.get(id)).filter(Boolean).map((d:any)=>({...d,distanceKm:dist.get(d.id)}));
    return j({ok:true,apiVersion:1,mode:'nearby',radiusKm:radius,latitude:lat,longitude:lng,count:deals.length,deals});
  }catch(e){console.error('perkdrop-nearby-api',e);return j({ok:false,error:'nearby_failed'},500)}
});
