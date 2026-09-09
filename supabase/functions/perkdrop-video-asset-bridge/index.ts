import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const TOKEN = "fjF14IXhJXmuMOukA-swKjXRPi4qWCgv";
const files: Record<string,string> = {
  "0804": "Rundle_Mall%27s_50th_Birthday_Moment_event_%28028A0804%29.jpg",
  "0813": "Rundle_Mall%27s_50th_Birthday_Moment_event_%28028A0813%29.jpg",
  "0803": "Rundle_Mall%27s_50th_Birthday_Moment_event_%28028A0803%29.jpg",
};
const bucket = "perkdrop-video-temp";

async function parseBody(req: Request) {
  const ct = req.headers.get("content-type") || "";
  if (ct.includes("application/json")) return await req.json();
  const text = await req.text();
  const p = new URLSearchParams(text);
  return Object.fromEntries(p.entries());
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method !== "POST") return new Response("method not allowed", {status:405});
    const body:any = await parseBody(req);
    if (body?.token !== TOKEN) return new Response("forbidden", {status:403});
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: buckets, error: listErr } = await sb.storage.listBuckets();
    if (listErr) throw listErr;
    if (!buckets?.some((b:any)=>b.name===bucket)) {
      const { error } = await sb.storage.createBucket(bucket, {public:true, fileSizeLimit:10000000, allowedMimeTypes:["image/jpeg"]});
      if (error) throw error;
    }
    const assets:any[] = [];
    for (const [key, filename] of Object.entries(files)) {
      const source = `https://commons.wikimedia.org/wiki/Special:Redirect/file/${filename}?width=1600`;
      const r = await fetch(source, {redirect:"follow",headers:{"User-Agent":"PerkDrop/1.0 media build"}});
      if (!r.ok) throw new Error(`${key}: upstream ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      const path = `rundle-${key}.jpg`;
      const { error } = await sb.storage.from(bucket).upload(path, bytes, {contentType:"image/jpeg",upsert:true,cacheControl:"60"});
      if (error) throw error;
      const { data } = sb.storage.from(bucket).getPublicUrl(path);
      assets.push({key,path,bytes:bytes.length,url:data.publicUrl});
    }
    return Response.json({ok:true,bucket,assets});
  } catch (e) {
    return Response.json({ok:false,error:String(e)}, {status:500});
  }
});

