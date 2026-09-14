import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const H = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "cache-control": "private, max-age=15" };
const valid = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
const australianPoint = (lat: number, lng: number) => valid(lat, -44, -10) && valid(lng, 112, 154);
const requestId = (req: Request) => { const supplied = req.headers.get("x-request-id")?.trim(); return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID(); };
const safe = (value: unknown) => String(value ?? "").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 100);
const reply = (id: string, body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...H, "x-perkdrop-request-id": id, ...extra } });
const recordFailure = async (sb: any, id: string, status: string, queries: string[], started: number) => {
  await sb.from("catalogue_api_failures").insert({ request_id: id, endpoint: "catalogue", failure_status: safe(status) || "dependency_failed", failed_queries: queries.map(safe), duration_ms: Math.min(120000, Math.max(0, Date.now() - started)) });
};
async function withRetry<T>(fn: () => Promise<T>, shouldRetry: (value: T) => boolean): Promise<T> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const value = await fn();
      if (!shouldRetry(value) || attempt === 1) return value;
    } catch (error) {
      if (attempt === 1) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 120));
  }
  throw new Error("retry_exhausted");
}

Deno.serve(async (req) => {
  const id = requestId(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: { ...H, "x-perkdrop-request-id": id } });
  if (req.method !== "GET") return reply(id, { ok: false, error: "method_not_allowed" }, 405);
  const started = Date.now();
  try {
    const u = new URL(req.url); const lat = Number(u.searchParams.get("lat")); const lng = Number(u.searchParams.get("lng"));
    const radius = Math.min(200, Math.max(1, Number(u.searchParams.get("radius_km") || 50) || 50)); const limit = Math.min(200, Math.max(1, Number(u.searchParams.get("limit") || 100) || 100));
    if (!australianPoint(lat, lng)) return reply(id, { ok: false, error: "valid_australian_lat_lng_required" }, 400);
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const nearby = await withRetry(() => sb.rpc("perkdrop_nearby_drop_ids", { p_lat: lat, p_lng: lng, p_radius_km: radius }), (result) => Boolean((result as { error?: unknown }).error));
    if (nearby.error) { const failure = safe(nearby.error.code || nearby.error.message || "rpc_failed"); console.warn("perkdrop-nearby-api rpc failure", { requestId: id, failure }); await recordFailure(sb, id, failure, ["nearby_rpc"], started); return reply(id, { ok: false, error: "nearby_unavailable", requestId: id }, 503, { "x-perkdrop-query-ms": String(Date.now() - started) }); }
    const ordered = (nearby.data || []).slice(0, limit); const ids = ordered.map((x: { id: string }) => x.id);
    if (!ids.length) return reply(id, { ok: true, mode: "nearby", radiusKm: radius, count: 0, deals: [] });
    const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/perkdrop-catalogue-api?limit=200`;
    let catalogue: Response;
    try { catalogue = await withRetry(() => fetch(base, { headers: { accept: "application/json", "x-request-id": id } }), (response) => !response.ok && response.status >= 500); }
    catch { await recordFailure(sb, id, "fetch_failed", ["catalogue_fetch"], started); return reply(id, { ok: false, error: "catalogue_unavailable", requestId: id }, 503); }
    if (!catalogue.ok) { const upstream = safe(catalogue.headers.get("x-perkdrop-request-id")); await recordFailure(sb, id, `http_${catalogue.status}`, ["catalogue_fetch"], started); return reply(id, { ok: false, error: "catalogue_unavailable", requestId: id }, 503, { "x-perkdrop-upstream-status": String(catalogue.status), ...(upstream ? { "x-perkdrop-upstream-request-id": upstream } : {}) }); }
    let cat: any;
    try { cat = await catalogue.json(); } catch { await recordFailure(sb, id, "invalid_json", ["catalogue_decode"], started); return reply(id, { ok: false, error: "catalogue_unavailable", requestId: id }, 503); }
    const byId = new Map((cat.deals || []).map((d: { id: string }) => [d.id, d])); const dist = new Map(ordered.map((x: { id: string; distance_km: number }) => [x.id, Number(x.distance_km)]));
    const deals = ids.map((dealId: string) => byId.get(dealId)).filter(Boolean).map((d: { id: string }) => ({ ...d, distanceKm: dist.get(d.id) }));
    return reply(id, { ok: true, apiVersion: 1, mode: "nearby", radiusKm: radius, latitude: lat, longitude: lng, count: deals.length, deals });
  } catch (error) { console.warn("perkdrop-nearby-api unavailable", { requestId: id }); return reply(id, { ok: false, error: "nearby_unavailable", requestId: id }, 503); }
});
