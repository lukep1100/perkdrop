import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { EXPECTED_CHANNELS, validateManifest, fingerprint, fetchPng, draftInput, assertDraft } from "../_shared/social-publishing.mjs";

const URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "social-publishing";
const POST_FIELDS = "id status text channelId dueAt assets { source mimeType }";
const allowedOrigins = new Set(["https://perkdrop.au","https://www.perkdrop.au","http://localhost:3000","http://localhost:3001"]);
class Fault extends Error { constructor(public code: number, message: string) { super(message); } }
const fail = (code: number, message: string): never => { throw new Fault(code,message); };
const safe = (error: unknown) => error instanceof Error ? error.message.slice(0,500) : "Operation failed.";
async function jobById(id: string) {
  if (!/^[a-f0-9-]{36}$/.test(id || "")) fail(400,"Invalid job ID.");
  const {data,error} = await db.from("social_publishing_jobs").select("*").eq("id",id).single();
  if (error || !data) fail(404,"Job not found.");
  return data;
}
async function updateJob(id: string, values: Record<string,unknown>, status?: string) {
  let q = db.from("social_publishing_jobs").update(values).eq("id",id);
  if (status) q = q.eq("status",status);
  const {data,error} = await q.select("*").maybeSingle();
  if (error) fail(500,"Could not persist job state. Check history before retrying.");
  if (!data) fail(409,"Job state changed. Refresh before continuing.");
  return data;
}
async function verify(job: any) {
  const checks = [];
  for (const asset of job.assets) {
    try { checks.push({ok:true,...await fetchPng(asset)}); }
    catch (e) { checks.push({ok:false,order:asset.order,url:asset.public_url,error:safe(e),verified_at:new Date().toISOString()}); }
  }
  return checks;
}
async function buffer(query: string, variables: any = {}) {
  // The Buffer credential is read only in server memory from Vault, never returned/logged.
  const {data:key,error} = await db.rpc("social_get_buffer_api_key");
  if (error || !key) fail(503,"Buffer credential is not available in Vault.");
  const response = await fetch("https://api.buffer.com", {
    method:"POST", headers:{"Authorization":"Bearer "+key,"Content-Type":"application/json"},
    body:JSON.stringify({query,variables}), signal:AbortSignal.timeout(20000),
  });
  if (!response.ok) fail(502,"Buffer HTTP "+response.status+". Check account status before retrying.");
  const result = await response.json();
  if (result.errors?.length || !result.data) fail(502,"Buffer rejected the API operation. No automatic retry was attempted.");
  return result.data;
}
async function settings() {
  const {data,error} = await db.from("social_publisher_config")
    .select("buffer_key_expires_at,key_rotation_warning_at,buffer_checked_at,buffer_connection_error,enabled")
    .eq("singleton",true).single();
  if(error) fail(500,"Could not load publishing configuration.");
  return {...data,channels:EXPECTED_CHANNELS,mode:"owner_approved_drafts_only"};
}
async function execute(body: any, user: any) {
  if(body.action === "list") {
    const {data,error} = await db.from("social_publishing_jobs").select("*").order("created_at",{ascending:false}).limit(50);
    if(error) fail(500,"Could not load jobs.");
    return {jobs:data,settings:await settings()};
  }
  if(body.action === "get") {
    const job = await jobById(body.job_id);
    const {data,error} = await db.from("social_publishing_events").select("*").eq("job_id",job.id).order("id",{ascending:false}).limit(100);
    if(error) fail(500,"Could not load status history.");
    return {job,events:data};
  }
  if(body.action === "create") {
    const assets = validateManifest(body.files);
    if(typeof body.caption !== "string" || !body.caption.trim() || body.caption.length>2200) fail(400,"Caption must be 1–2200 characters.");
    if(typeof body.title !== "string" || !body.title.trim() || body.title.length>160) fail(400,"Title must be 1–160 characters.");
    if(!Array.isArray(body.channels) || body.channels.length<1 || body.channels.length>2 ||
       new Set(body.channels).size!==body.channels.length || body.channels.some((c:string)=>!EXPECTED_CHANNELS[c]))
      fail(400,"Choose Instagram and/or Facebook. TikTok is not supported for this carousel.");
    if(!/^[a-f0-9-]{36}$/.test(body.job_id || "")) fail(400,"A stable job ID is required.");
    const channels = body.channels.map((platform:string)=>({platform,...EXPECTED_CHANNELS[platform]}));
    const content = {caption:body.caption,channels,assets};
    const hash = await fingerprint(content);
    const {data:existing} = await db.from("social_publishing_jobs").select("*").eq("id",body.job_id).maybeSingle();
    if(existing) {
      if(await fingerprint(existing)!==hash || existing.title!==body.title) fail(409,"This job ID already belongs to different content.");
      return {job:existing};
    }
    const {data,error} = await db.from("social_publishing_jobs").insert({
      id:body.job_id,title:body.title,...content,created_by:user.id,preview_hash:hash,
    }).select("*").single();
    if(error) fail(409,"Could not create job. Refresh before retrying the same job ID.");
    return {job:data};
  }
  if(body.action === "upload_urls") {
    const job = await jobById(body.job_id);
    if(!["uploading","verification_failed"].includes(job.status)) fail(409,"This job does not accept uploads.");
    const uploads = [];
    for(const a of job.assets) {
      const {data,error} = await db.storage.from(BUCKET).createSignedUploadUrl(a.storage_path,{upsert:false});
      if(error) fail(500,"Could not authorize media upload.");
      uploads.push({order:a.order,path:a.storage_path,token:data.token});
    }
    return {uploads};
  }
  if(body.action === "verify") {
    let job = await jobById(body.job_id);
    if(!["uploading","verification_failed"].includes(job.status)) fail(409,"Only new or failed previews can be verified.");
    job = await updateJob(job.id,{status:"verifying",error:null},job.status);
    const verification = await verify(job);
    const ok = verification.every(v=>v.ok);
    job = await updateJob(job.id,{status:ok?"ready":"verification_failed",verification,
      preview_hash:await fingerprint(job),verified_at:new Date().toISOString(),
      error:ok?null:{code:"MEDIA_VERIFICATION_FAILED",message:"All five original PNGs must pass before approval."}}, "verifying");
    return {job};
  }
  if(body.action === "recover") {
    const job = await jobById(body.job_id);
    if(!["verifying","drafting"].includes(job.status) || Date.now()-Date.parse(job.updated_at)<180000)
      fail(409,"Recovery is only available for an operation stalled for over three minutes.");
    return {job:await updateJob(job.id,{
      status:job.status==="drafting"?"reconciliation_required":"verification_failed",
      error:{code:"INTERRUPTED",message:job.status==="drafting"?"Inspect Buffer before any further creation. The previous request may have succeeded.":"Verification was interrupted. Retry is safe."}
    },job.status)};
  }
  if(body.action === "check_buffer") {
    try {
      const data = await buffer('query { channels(input:{organizationId:"6a90f878f88f2490182a9b02"}) { id name service isDisconnected isLocked } }');
      // Verify actual account membership, not merely the configured channel names.
      const channels = data.channels || [];
      for(const [platform,expected] of Object.entries(EXPECTED_CHANNELS))
        if(!channels.some((c:any)=>c.id===expected.id && c.service===platform && !c.isDisconnected && !c.isLocked)) fail(502,"Expected "+platform+" channel is missing, disconnected or locked.");
      await db.from("social_publisher_config").update({buffer_checked_at:new Date().toISOString(),buffer_connection_error:null}).eq("singleton",true);
      return {ok:true,channels:channels.filter((c:any)=>Object.values(EXPECTED_CHANNELS).some(e=>e.id===c.id))};
    } catch(e) {
      await db.from("social_publisher_config").update({buffer_checked_at:new Date().toISOString(),buffer_connection_error:safe(e)}).eq("singleton",true);
      throw e;
    }
  }
  if(body.action === "approve_drafts") {
    let job = await jobById(body.job_id);
    if(body.confirmation!=="CREATE_BUFFER_DRAFTS" || body.preview_hash!==job.preview_hash ||
       await fingerprint(job)!==body.preview_hash) fail(409,"Approval must match the exact current preview.");
    if(!["ready","draft_failed"].includes(job.status)) fail(409,"This job is not eligible for draft creation.");
    const config = await settings();
    if(config.enabled !== true) fail(409,"Buffer publishing is disabled in production. No draft request is available.");
    if(!config.buffer_key_expires_at || Date.now()>=Date.parse(config.buffer_key_expires_at+"T00:00:00Z"))
      fail(409,"Rotate the expired Buffer key in Vault before creating drafts.");
    job = await updateJob(job.id,{status:"drafting",approved_by:user.id,approved_at:new Date().toISOString(),error:null},job.status);
    const verification = await verify(job);
    if(!verification.every(v=>v.ok)) return {job:await updateJob(job.id,{status:"verification_failed",verification,
      error:{code:"MEDIA_CHANGED",message:"Hosted media failed re-verification. No new Buffer request was made."}},"drafting")};
    const posts = {...job.buffer_posts};
    for(const channel of job.channels) {
      if(posts[channel.platform]?.id) continue;
      // Persist the attempt BEFORE the remote write. A timeout or crash requires reconciliation, never blind retry.
      posts[channel.platform] = {attempted_at:new Date().toISOString(),state:"attempting"};
      await updateJob(job.id,{buffer_posts:posts},"drafting");
      try {
        const result = await buffer('mutation Draft($input: CreatePostInput!) { createPost(input:$input) { ... on PostActionSuccess { post { '+POST_FIELDS+' } } ... on MutationError { message } } }',
          {input:draftInput(job,channel)});
        const post = result.createPost?.post;
        if(!post) {
          // A business error is definite only when the mutation returned its explicit error payload.
          if(result.createPost?.message) {
            posts[channel.platform]={state:"failed",error:"Buffer rejected this draft. Check channel connection and account limits."};
            return {job:await updateJob(job.id,{status:"draft_failed",buffer_posts:posts,
              error:{code:"BUFFER_REJECTED",platform:channel.platform,message:posts[channel.platform].error}},"drafting")};
          }
          throw new Error("Buffer did not return a verifiable post. Inspect Buffer before retrying.");
        }
        posts[channel.platform]={id:post.id,status:post.status,state:"returned",checked_at:new Date().toISOString()};
        await updateJob(job.id,{buffer_posts:posts},"drafting");
        const confirmed = await buffer('query Confirm($id: PostId!) { post(input:{id:$id}) { '+POST_FIELDS+' } }',{id:post.id});
        assertDraft(confirmed.post,job,channel);
        posts[channel.platform]={id:post.id,status:"draft",state:"verified",checked_at:new Date().toISOString()};
        await updateJob(job.id,{buffer_posts:posts},"drafting");
      } catch(e) {
        return {job:await updateJob(job.id,{status:"reconciliation_required",buffer_posts:posts,
          error:{code:"BUFFER_UNCERTAIN",platform:channel.platform,message:safe(e)}},"drafting")};
      }
    }
    return {job:await updateJob(job.id,{status:"drafted",buffer_posts:posts,verification,error:null},"drafting")};
  }
  fail(400,"Unknown action. Scheduling and publishing are not supported.");
}
Deno.serve(async req => {
  const origin = req.headers.get("origin");
  const headers: Record<string,string> = {"Content-Type":"application/json","Cache-Control":"private, no-store","Vary":"Origin"};
  if(origin && allowedOrigins.has(origin)) headers["Access-Control-Allow-Origin"]=origin;
  headers["Access-Control-Allow-Headers"]="authorization, apikey, content-type";
  headers["Access-Control-Allow-Methods"]="POST, OPTIONS";
  const reply = (status:number,value:any) => new Response(JSON.stringify(value),{status,headers});
  if(origin && !allowedOrigins.has(origin)) return reply(403,{error:"Origin not allowed."});
  if(req.method==="OPTIONS") return new Response(null,{status:204,headers});
  if(req.method!=="POST") return reply(405,{error:"POST required."});
  try {
    const token = req.headers.get("authorization")?.match(/^Bearer (.+)$/i)?.[1];
    if(!token) fail(401,"Owner sign-in required.");
    const {data,error} = await db.auth.getUser(token);
    if(error || !data.user) fail(401,"Owner session is invalid or expired.");
    const {data:owner,error:ownerError} = await db.from("admin_users").select("user_id").eq("user_id",data.user.id).maybeSingle();
    if(ownerError || !owner) fail(403,"Owner access required.");
    const raw = await req.text();
    if(raw.length>25000) fail(413,"Request is too large.");
    let body;try{body=JSON.parse(raw);}catch{fail(400,"Invalid JSON.");}
    return reply(200,await execute(body,data.user));
  } catch(e) {
    return reply(e instanceof Fault?e.code:400,{error:safe(e)});
  }
});
