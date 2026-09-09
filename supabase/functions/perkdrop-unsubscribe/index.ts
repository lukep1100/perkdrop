import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const page=(title:string,body:string,status=200)=>new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title><style>body{margin:0;background:#08090e;color:#f5f6f8;font:16px/1.5 Arial,sans-serif;display:grid;place-items:center;min-height:100vh}.box{max-width:560px;margin:20px;padding:24px;border:1px solid #2c3140;border-radius:18px;background:#11131b}h1{margin-top:0}p{color:#b8bdc7}a{color:#ff4db8}</style></head><body><div class="box"><h1>${title}</h1><p>${body}</p><p><a href="https://perkdrop.au">PerkDrop</a></p></div></body></html>`,{status,headers:{'content-type':'text/html; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex'}});
Deno.serve(async(req)=>{
 if(req.method!=='GET')return page('Method not allowed','This link only supports unsubscribe requests.',405);
 try{
  const u=new URL(req.url),token=(u.searchParams.get('token')||'').trim();
  if(!/^[0-9a-f-]{36}$/i.test(token))return page('Invalid unsubscribe link','This unsubscribe link is invalid.',400);
  const sb=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const {data:msg}=await sb.from('outreach_messages').select('id,merchant_id,email,status').eq('unsubscribe_token',token).maybeSingle();
  if(!msg)return page('Link not found','This unsubscribe link is no longer valid.',404);
  await Promise.all([
    sb.from('outreach_messages').update({status:'unsubscribed',updated_at:new Date().toISOString()}).eq('id',msg.id),
    sb.from('outreach_contacts').update({status:'unsubscribed',unsubscribe_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('merchant_id',msg.merchant_id).eq('email',msg.email),
    sb.from('merchants').update({do_not_contact:true}).eq('id',msg.merchant_id),
    sb.from('outreach_suppression').upsert({email:msg.email,merchant_id:msg.merchant_id,reason:'unsubscribe',source:'perkdrop-unsubscribe'},{onConflict:'email'})
  ]);
  return page('Unsubscribed','You will not receive further PerkDrop marketing emails at this address.');
 }catch(e){console.error('perkdrop-unsubscribe',e);return page('Could not process request','Please contact perkdropofficial@gmail.com and we will remove the address manually.',500)}
});
