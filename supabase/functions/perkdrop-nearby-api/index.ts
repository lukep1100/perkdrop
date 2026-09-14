import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const H = { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "access-control-allow-methods": "GET, OPTIONS", "cache-control": "private, max-age=15" };
const valid = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
const australianPoint = (lat: number, lng: number) => valid(lat, -44, -10) && valid(lng, 112, 154);
const requestId = (req: Request) => { const supplied = req.headers.get("x-request-id")?.trim(); return supplied && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID(); };
const safe = (value: unknown) => String(value ?? "").replace(/[^A-Za-z0-9._:-]/g, "").slice(0, 100);
const reply = (id: string, body: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { ...H, "x-perkdrop-request-id": id, ...extra } });
async function withRetry<T>(fn: () => Promise<T>, shouldRetry: (value: T) => boolean): Promise<T> { let value = await fn(); if (shouldRetry(value)) { await new Promise((resolve) => setTimeout(resolve, 120)); value = await fn(); } return value; }

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
    if (nearby.error) { console.warn("perkdrop-nearby-api rpc failure", { requestId: id, failure: safe(nearby.error.code || nearby.error.message || "rpc_failed") }); return reply(id, { ok: false, error: "nearby_unavailable", requestId: id }, 503, { "x-perkdrop-query-ms": String(Date.now() - started) }); }
    const ordered = (nearby.data || []).slice(0, limit); const ids = ordered.map((x: { id: string }) => x.id);
    if (!ids.length) return reply(id, { ok: true, mode: "nearby", radiusKm: radius, count: 0, deals: [] });
    const base = `${Deno.env.get("SUPABASE_URL")}/functions/v1/perkdrop-catalogue-api?limit=200`;
    const catalogue = await withRetry(() => fetch(base, { headers: { accept: "application/json", "x-request-id": id } }), (response) => !response.ok && response.status >= 500);
    if (!catalogue.ok) { const upstream = safe(catalogue.headers.get("x-perkdrop-request-id")); return reply(id, { ok: false, error: "catalogue_unavailable", requestId: id }, 503, { "x-perkdrop-upstream-status": String(catalogue.status), ...(upstream ? { "x-perkdrop-upstream-request-id": upstream } : {}) }); }
    const cat = await catalogue.json(); const byId = new Map((cat.deals || []).map((d: { id: string }) => [d.id, d])); const dist = new Map(ordered.map((x: { id: string; distance_km: number }) => [x.id, Number(x.distance_km)]));
    const deals = ids.map((dealId: string) => byId.get(dealId)).filter(Boolean).map((d: { id: string }) => ({ ...d, distanceKm: dist.get(d.id) }));
    return reply(id, { ok: true, apiVersion: 1, mode: "nearby", radiusKm: radius, latitude: lat, longitude: lng, count: deals.length, deals });
  } catch (error) { console.warn("perkdrop-nearby-api unavailable", { requestId: id }); return reply(id, { ok: false, error: "nearby_unavailable", requestId: id }, 503); }
});
