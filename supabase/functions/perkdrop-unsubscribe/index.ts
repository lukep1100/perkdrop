import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
const headers={'content-type':'application/json','cache-control':'no-store','x-robots-tag':'noindex','referrer-policy':'no-referrer'};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers});
Deno.serve(async req=>{
  // Email scanners follow GET links. Only a deliberate form POST applies policy.
  if(req.method==='GET'){
    const u=new URL('https://perkdrop.au/unsubscribe'),token=new URL(req.url).searchParams.get('token')||'';
    if(/^[0-9a-f-]{36}$/i.test(token))u.searchParams.set('token',token);
    return new Response(null,{status:303,headers:{...headers,location:u.href}});
  }
  if(req.method!=='POST')return json({ok:false,error:'method_not_allowed'},405);
  try{
    const raw=await req.text();if(raw.length>200)return json({ok:false,error:'invalid_request'},400);
    const {token}=JSON.parse(raw);
    if(typeof token!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token))return json({ok:false,error:'invalid_link'},400);
    const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data,error}=await sb.rpc('unsubscribe_outreach',{p_token:token});
    if(error)return json({ok:false,error:'try_again'},503);
    return data?json({ok:true}):json({ok:false,error:'link_not_found'},404);
  }catch{return json({ok:false,error:'invalid_request'},400);}
});
