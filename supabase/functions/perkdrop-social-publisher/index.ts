import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUFFER_API = "https://api.buffer.com";
const dbHeaders = { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}`, "Content-Type":"application/json" };

function json(data: unknown, status=200){ return new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json","cache-control":"no-store"}}); }
async function rest(path:string, init:RequestInit={}){ const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{...init,headers:{...dbHeaders,...(init.headers||{})}}); if(!r.ok) throw new Error(`DB ${r.status}: ${await r.text()}`); const text=await r.text(); return text?JSON.parse(text):null; }
async function patch(table:string, filter:string, body:unknown){ return rest(`${table}?${filter}`,{method:"PATCH",headers:{"Prefer":"return=minimal"},body:JSON.stringify(body)}); }
async function config(){ const rows=await rest(`social_publisher_config?singleton=eq.true&select=*`); return rows?.[0]||null; }
async function getBufferKey(){ const data=await rest(`rpc/social_get_buffer_api_key`,{method:"POST",body:"{}"}); return typeof data==="string"?data:String(data||""); }
async function campaign(id:string){ const rows=await rest(`social_campaigns?id=eq.${encodeURIComponent(id)}&select=*`); return rows?.[0]||null; }
function gqlString(v:any){ return JSON.stringify(String(v??"")); }

async function createBufferPost(apiKey:string, post:any, camp:any){
  const media=String(camp.media_url||"").trim();
  if(!media) throw new Error("Campaign has no approved media_url");
  const due = post.scheduled_for || camp.scheduled_for;
  if(!due) throw new Error("Campaign has no scheduled_for time");
  const dueISO = new Date(due).toISOString();
  const contentType=String(post.metadata?.content_type||"").toLowerCase();
  const isVideo=contentType.includes("video") || /\.(mp4|mov|m4v|webm)(\?|$)/i.test(media);
  const asset = isVideo
    ? `{ video: { url: ${gqlString(media)} metadata: { thumbnailOffset: 1000 } } }`
    : `{ image: { url: ${gqlString(media)} } }`;
  const metadata = post.platform === "instagram"
    ? `metadata: { instagram: { type: reel shouldShareToFeed: true isAiGenerated: false } }`
    : `metadata: { facebook: { type: reel } }`;
  const mutation = `mutation { createPost(input: { text: ${gqlString(post.caption)} channelId: ${gqlString(post.buffer_channel_id)} schedulingType: automatic mode: customScheduled dueAt: ${gqlString(dueISO)} assets: [${asset}] ${metadata} }) { ... on PostActionSuccess { post { id text dueAt } } ... on MutationError { message } } }`;
  const r=await fetch(BUFFER_API,{method:"POST",headers:{"content-type":"application/json","authorization":`Bearer ${apiKey}`},body:JSON.stringify({query:mutation})});
  const body=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(`Buffer HTTP ${r.status}`);
  if(body.errors?.length) throw new Error(body.errors.map((x:any)=>x.message).join("; "));
  const result=body.data?.createPost;
  if(result?.message) throw new Error(result.message);
  if(!result?.post?.id) throw new Error("Buffer did not return a post id");
  return result.post;
}

Deno.serve(async(req:Request)=>{
  try{
    if(req.method==="GET") return json({ok:true,service:"perkdrop-social-publisher",platforms:["instagram","facebook"],tiktok:"buffer-composer"});
    if(req.method!=="POST") return json({error:"method_not_allowed"},405);
    const cfg=await config();
    const supplied=req.headers.get("x-perkdrop-publish-secret")||"";
    if(!cfg?.publish_secret || supplied!==cfg.publish_secret) return json({error:"unauthorized"},401);
    if(!cfg.enabled) return json({error:"publisher_disabled"},409);
    const apiKey=await getBufferKey();
    if(!apiKey) return json({error:"buffer_key_missing"},409);

    const posts=await rest(`social_posts?status=eq.queued&platform=in.(instagram,facebook)&buffer_channel_id=not.is.null&select=*&order=created_at.asc&limit=20`);
    const results:any[]=[];
    for(const p of (posts||[])){
      if(p.buffer_post_id){ results.push({id:p.id,platform:p.platform,status:"already_buffered",buffer_post_id:p.buffer_post_id}); continue; }
      const camp=await campaign(p.campaign_id);
      if(!camp || camp.status!=="queued"){ results.push({id:p.id,platform:p.platform,status:"skipped_campaign_not_queued"}); continue; }
      try{
        const bp=await createBufferPost(apiKey,p,camp);
        await patch("social_posts",`id=eq.${encodeURIComponent(p.id)}`,{buffer_post_id:String(bp.id),scheduled_for:bp.dueAt||p.scheduled_for||camp.scheduled_for,error_text:null,updated_at:new Date().toISOString()});
        results.push({id:p.id,platform:p.platform,status:"buffered",buffer_post_id:bp.id,dueAt:bp.dueAt});
      }catch(err){
        const message=err instanceof Error?err.message:String(err);
        await patch("social_posts",`id=eq.${encodeURIComponent(p.id)}`,{status:"failed",error_text:message.slice(0,900),updated_at:new Date().toISOString()});
        results.push({id:p.id,platform:p.platform,status:"failed",error:message});
      }
    }
    await patch("social_publisher_config","singleton=eq.true",{last_publish_run_at:new Date().toISOString(),last_error:results.some(x=>x.status==="failed")?"One or more Buffer posts failed":null,updated_at:new Date().toISOString()});
    return json({ok:true,processed:results.length,results});
  }catch(err){
    const message=err instanceof Error?err.message:String(err);
    try{await patch("social_publisher_config","singleton=eq.true",{last_publish_run_at:new Date().toISOString(),last_error:message.slice(0,900),updated_at:new Date().toISOString()});}catch{}
    return json({ok:false,error:message},500);
  }
});
