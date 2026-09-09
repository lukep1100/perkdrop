import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BUFFER_API = "https://api.buffer.com";

const restHeaders = {
  apikey: SERVICE_KEY,
  Authorization: `Bearer ${SERVICE_KEY}`,
  "Content-Type": "application/json",
};

function htmlResponse(body: string, status = 200) {
  const h = new Headers();
  h.set("Content-Type", "text/html; charset=UTF-8");
  h.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  h.set("Pragma", "no-cache");
  h.set("X-Content-Type-Options", "nosniff");
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>PerkDrop - Connect Buffer</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;background:#090a0f;color:#f5f5f7;font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;min-height:100vh;display:grid;place-items:center;padding:24px}.card{width:min(560px,100%);background:#12141d;border:1px solid #2a2d3a;border-radius:24px;padding:28px;box-shadow:0 20px 60px #0008}.logo{font-size:29px;font-weight:900;margin-bottom:8px}.logo span{background:linear-gradient(90deg,#8f2cff,#ff2f8e);-webkit-background-clip:text;background-clip:text;color:transparent}h1{font-size:24px;margin:14px 0 8px}p{color:#c1c5d0;line-height:1.55}.note{background:#191c27;border:1px solid #292d3b;border-radius:14px;padding:14px 15px;margin:16px 0;font-size:14px}label{font-weight:750;display:block;margin:18px 0 8px}input{width:100%;padding:15px 16px;border-radius:14px;border:1px solid #353948;background:#0d0f16;color:#fff;font-size:16px;outline:none}input:focus{border-color:#a44dff;box-shadow:0 0 0 3px #8f2cff22}button{margin-top:14px;width:100%;border:0;border-radius:14px;padding:15px 18px;font-size:16px;font-weight:850;color:#fff;background:linear-gradient(90deg,#8f2cff,#ff2f8e);cursor:pointer}.ok{border-left:4px solid #43d9a3;padding-left:14px}.bad{border-left:4px solid #ff5b72;padding-left:14px}.small{font-size:12px;color:#858b9c;margin-top:14px}.channels{display:grid;gap:8px;margin:16px 0}.ch{display:flex;justify-content:space-between;gap:12px;background:#0d0f16;border-radius:12px;padding:12px 14px}.yes{color:#5ae1ac}.manual{color:#ffd166}
</style>
</head>
<body><main class="card">${body}</main></body>
</html>`, { status, headers: h });
}

function safe(s: unknown) {
  return String(s ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

async function sha256(text: string) {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getConfig() {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/social_publisher_config?singleton=eq.true&select=*`, { headers: restHeaders });
  if (!r.ok) throw new Error(`Config read failed (${r.status})`);
  const rows = await r.json();
  return rows?.[0] ?? null;
}

async function validToken(token: string) {
  if (!token) return false;
  const c = await getConfig();
  if (!c || c.setup_used_at || !c.setup_expires_at || new Date(c.setup_expires_at).getTime() < Date.now()) return false;
  return (await sha256(token)) === c.setup_token_hash;
}

async function patch(table: string, query: string, body: unknown) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: "PATCH",
    headers: { ...restHeaders, Prefer: "return=minimal" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${table} update failed (${r.status})`);
}

async function storeKey(apiKey: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/social_store_buffer_api_key`, {
    method: "POST",
    headers: restHeaders,
    body: JSON.stringify({ p_api_key: apiKey }),
  });
  if (!r.ok) throw new Error(`Secure key storage failed (${r.status})`);
}

async function bufferGraphQL(apiKey: string, query: string, variables: Record<string, unknown> = {}) {
  const r = await fetch(BUFFER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ query, variables }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`Buffer returned HTTP ${r.status}`);
  if (data.errors?.length) throw new Error(data.errors.map((x: any) => x.message).join("; "));
  return data.data;
}

function chooseChannel(channels: any[], service: string) {
  const matches = channels.filter(c => String(c.service || "").toLowerCase() === service);
  return matches.find(c => /perk\s*drop/i.test(String(c.name || ""))) || matches[0] || null;
}

Deno.serve(async (req: Request) => {
  try {
    const url = new URL(req.url);

    if (req.method === "GET") {
      const token = url.searchParams.get("token") || "";
      if (!(await validToken(token))) {
        return htmlResponse(`<div class="logo">Perk<span>Drop</span></div><h1>Setup link expired</h1><p class="bad">This one-time setup link is invalid, expired, or has already been used.</p>`, 403);
      }
      return htmlResponse(`<div class="logo">Perk<span>Drop</span></div><h1>Connect your Buffer account</h1><p>This connects Buffer to PerkDrop so PerkDrop can prepare and schedule supported social posts automatically.</p><div class="note"><b>Paste your Buffer Personal API Key below.</b><br>The key is stored in encrypted Supabase Vault and is not displayed again after setup.</div><form method="post" accept-charset="UTF-8"><input type="hidden" name="token" value="${safe(token)}"><label for="apiKey">Buffer Personal API Key</label><input id="apiKey" name="apiKey" type="password" autocomplete="off" spellcheck="false" required placeholder="Paste API key here"><button type="submit">Connect Buffer to PerkDrop</button></form><div class="small">Single-use setup link. Do not paste the API key into ChatGPT.</div>`);
    }

    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    const ct = req.headers.get("content-type") || "";
    let token = "", apiKey = "";
    if (ct.includes("application/json")) {
      const body = await req.json();
      token = String(body.token || "");
      apiKey = String(body.apiKey || "").trim();
    } else {
      const form = await req.formData();
      token = String(form.get("token") || "");
      apiKey = String(form.get("apiKey") || "").trim();
    }

    if (!(await validToken(token))) return htmlResponse(`<div class="logo">Perk<span>Drop</span></div><h1>Setup link expired</h1><p class="bad">Generate a fresh one-time setup link before trying again.</p>`, 403);
    if (apiKey.length < 12) return htmlResponse(`<div class="logo">Perk<span>Drop</span></div><h1>API key missing</h1><p class="bad">The Buffer API key was empty or too short.</p>`, 400);

    const account = await bufferGraphQL(apiKey, `query { account { organizations { id name } } }`);
    const org = account?.account?.organizations?.[0];
    if (!org?.id) throw new Error("No Buffer organization was returned for this API key.");

    const chData = await bufferGraphQL(apiKey, `query Channels($org: OrganizationId!) { channels(input: { organizationId: $org }) { id name service } }`, { org: org.id });
    const channels = Array.isArray(chData?.channels) ? chData.channels : [];
    const ig = chooseChannel(channels, "instagram");
    const fb = chooseChannel(channels, "facebook");
    const tt = chooseChannel(channels, "tiktok");

    if (!ig && !fb) throw new Error("Buffer connected, but no Instagram or Facebook channel was found. Connect those channels in Buffer first.");

    await storeKey(apiKey);
    for (const [platform, channel] of [["instagram", ig], ["facebook", fb], ["tiktok", tt]] as const) {
      if (channel?.id) await patch("social_channels", `platform=eq.${platform}`, { buffer_channel_id: String(channel.id), updated_at: new Date().toISOString() });
    }

    await patch("social_publisher_config", "singleton=eq.true", {
      enabled: Boolean(ig && fb),
      buffer_organization_id: String(org.id),
      last_channel_sync_at: new Date().toISOString(),
      setup_used_at: new Date().toISOString(),
      last_error: null,
      updated_at: new Date().toISOString(),
    });

    return htmlResponse(`<div class="logo">Perk<span>Drop</span></div><h1>Buffer connected</h1><p class="ok">PerkDrop is linked to your Buffer account.</p><div class="channels"><div class="ch"><span>Instagram</span><b class="${ig ? "yes" : "manual"}">${ig ? "Connected" : "Not found"}</b></div><div class="ch"><span>Facebook</span><b class="${fb ? "yes" : "manual"}">${fb ? "Connected" : "Not found"}</b></div><div class="ch"><span>TikTok</span><b class="manual">${tt ? "Detected in Buffer" : "Buffer composer"}</b></div></div><div class="small">You can close this page now.</div>`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    try { await patch("social_publisher_config", "singleton=eq.true", { last_error: message.slice(0, 900), updated_at: new Date().toISOString() }); } catch {}
    return htmlResponse(`<div class="logo">Perk<span>Drop</span></div><h1>Connection not completed</h1><p class="bad">${safe(message)}</p><p>Fix the issue above and try again while the setup link is still valid.</p>`, 400);
  }
});
