import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const SOURCE='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-booking-page?offer=5f1a5ca3-30ba-4747-869a-0a60edb596c7&party=2';
const BUCKET='perkdrop-previews';
const PATH='union-hotel/index.html';

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed',{status:405});
  const u=new URL(req.url);
  if(u.searchParams.get('key')!=='union-preview-v1') return new Response('Forbidden',{status:403});
  try{
    const r=await fetch(SOURCE,{headers:{accept:'text/html'},cache:'no-store'});
    const html=await r.text();
    if(!r.ok||!/^\s*<!doctype html>/i.test(html)) return new Response(JSON.stringify({ok:false,error:'source_invalid'}),{status:502,headers:{'content-type':'application/json'}});
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const body=new Blob([html],{type:'text/html'});
    const {error}=await sb.storage.from(BUCKET).upload(PATH,body,{contentType:'text/html',upsert:true,cacheControl:'0'});
    if(error) return new Response(JSON.stringify({ok:false,error:error.message}),{status:500,headers:{'content-type':'application/json'}});
    const {data}=sb.storage.from(BUCKET).getPublicUrl(PATH);
    return new Response(JSON.stringify({ok:true,url:data.publicUrl}),{status:200,headers:{'content-type':'application/json','cache-control':'no-store'}});
  }catch(e){return new Response(JSON.stringify({ok:false,error:String(e)}),{status:500,headers:{'content-type':'application/json'}})}
});
