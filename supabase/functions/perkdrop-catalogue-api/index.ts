import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.102.0";
import { isAustralianPoint, localDay, approvedImage, directoryVisible, categoryVertical, eventEnded } from "../_shared/discovery.ts";

const headers = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, OPTIONS",
  "cache-control": "no-store",
};
const tracker = (id: string) =>
  `https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-go?drop=${encodeURIComponent(id)}&from=detail&utm_source=perkdrop&utm_medium=referral&utm_campaign=verified_catalogue`;
const nav = (d: any, lat: number | null, lng: number | null) =>
  `https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-nav?drop=${encodeURIComponent(d.id)}&from=detail${lat !== null && lng !== null ? `&lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}` : `&loc=${encodeURIComponent(d.location || d.merchant || "")}`}`;
const portal = (slug: string) =>
  `https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-portal?merchant=${encodeURIComponent(slug)}`;
const cityLabel = (s: string) =>
  (
    ({
      adelaide: "Adelaide",
      sydney: "Sydney",
      melbourne: "Melbourne",
      brisbane: "Brisbane",
      perth: "Perth",
      darwin: "Darwin",
      canberra: "Canberra",
      hobart: "Hobart",
      "gold-coast": "Gold Coast",
    }) as Record<string, string>
  )[s] || s;
function publicState(
  listingStatus: string,
  partnerTier: string,
  exclusive: boolean,
) {
  if (exclusive)
    return { key: "exclusive", label: "PERKDROP EXCLUSIVE", icon: "🔥" };
  if (listingStatus === "partner" || partnerTier !== "none")
    return { key: "partner", label: "PERKDROP PARTNER", icon: "💜" };
  if (listingStatus === "verified" || listingStatus === "claimed")
    return { key: "verified", label: "VERIFIED BY BUSINESS", icon: "✓" };
  if (listingStatus === "claim_pending")
    return { key: "claim_pending", label: "CLAIM PENDING", icon: "◷" };
  return { key: "unclaimed", label: "UNCLAIMED", icon: "" };
}
function isFoodLike(d: any, m: any) {
  return (
    String(d.vertical || "").toLowerCase() === "food" ||
    /food|restaurant|burger|pizza|schnitzel|meal|cafe|dining|pasta|kitchen|bakery|seafood|pub|hotel/.test(
      `${d.category || ""} ${d.kind || ""} ${d.cuisine || ""} ${d.venue_type || ""} ${m?.cuisine || ""} ${m?.venue_type || ""} ${d.title || ""}`.toLowerCase(),
    )
  );
}
function unitLabel(unit: string, food: boolean) {
  return (
    (
      {
        diner: "DINERS",
        person: "PEOPLE",
        ticket: "TICKETS",
        appointment: "APPOINTMENTS",
        booking: "BOOKINGS",
        room: "ROOMS",
        tee_time: "PLAYER SPOTS",
        class_spot: "CLASS SPOTS",
        item: "ITEMS",
        package: "PACKAGES",
        other: "UNITS",
      } as Record<string, string>
    )[unit] || (food ? "DINERS" : "UNITS")
  );
}
function localParts(tz: string) {
  try {
    const parts = new Intl.DateTimeFormat("en-AU", {
      timeZone: tz || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(new Date());
    const m: any = {};
    for (const p of parts) m[p.type] = p.value;
    return {
      date: `${m.year}-${m.month}-${m.day}`,
      minutes: Number(m.hour) * 60 + Number(m.minute),
    };
  } catch {
    const n = new Date();
    return {
      date: n.toISOString().slice(0, 10),
      minutes: n.getUTCHours() * 60 + n.getUTCMinutes(),
    };
  }
}
const QUERY_RETRY_DELAY_MS = 150;
function isTransientQueryError(error: any) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.cause?.status);
  if ([408, 409, 429, 500, 502, 503, 504].includes(status)) return true;
  const message = String(error?.message || error || "").toLowerCase();
  return /network|fetch failed|timeout|timed out|temporarily unavailable|connection reset|econnreset|socket/i.test(message);
}
function queryErrorLabel(error: any) {
  const status = Number(error?.status ?? error?.statusCode ?? error?.cause?.status);
  if (Number.isFinite(status) && status > 0) return `http_${status}`;
  const code = String(error?.code || error?.name || "unknown")
    .replace(/[^a-z0-9_-]/gi, "_")
    .slice(0, 48);
  return code || "unknown";
}
async function recordFailure(
  db: any,
  requestId: string,
  endpoint: "health" | "catalogue" | "slug",
  failed: string[],
  statuses: string[],
  durationMs: number,
) {
  try {
    await db.from("catalogue_api_failures").insert({
      request_id: requestId,
      endpoint,
      failure_status: statuses.length === 1 ? statuses[0] : "multi_failure",
      failed_queries: failed.map((name, i) => `${name}:${statuses[i] || "unknown"}`).slice(0, 6),
      duration_ms: Math.max(0, Math.min(120000, Math.round(durationMs))),
    });
  } catch {
    // Failure telemetry must never change the client's truthful error path.
  }
}
async function queryWithRetry(run: () => Promise<any>) {
  let result: any = null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      result = await run();
    } catch (error) {
      result = { data: null, error };
    }
    if (!result?.error || !isTransientQueryError(result.error) || attempt === 1)
      return result;
    await new Promise((resolve) => setTimeout(resolve, QUERY_RETRY_DELAY_MS));
  }
  return result;
}
// Keep a catalogue request from fanning out all six PostgREST reads at once.
// A small bounded wave protects the shared project connection pool while
// preserving the existing per-query transient retry and truthful failure path.
async function runQueryWaves(tasks: Array<() => Promise<any>>, width = 2) {
  const results: any[] = [];
  for (let i = 0; i < tasks.length; i += width) {
    results.push(...(await Promise.all(tasks.slice(i, i + width).map((task) => task()))));
  }
  return results;
}
function timeMinutes(v: any) {
  const [h, m] = String(v || "00:00")
    .split(":")
    .map(Number);
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}
function isUpcomingSession(s: any) {
  const now = localParts(s.timezone || "UTC");
  if (String(s.service_date) > now.date) return true;
  if (String(s.service_date) < now.date) return false;
  return now.minutes < timeMinutes(s.service_end || "23:59");
}
function sessionLabel(s: any) {
  if (!s?.service_date) return "";
  try {
    return new Date(`${s.service_date}T12:00:00Z`).toLocaleDateString("en-AU", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return String(s.service_date);
  }
}
function priorityScore(
  d: any,
  offer: any,
  merchant: any,
  campaignDrops: Set<string>,
  campaignOffers: Set<string>,
) {
  if(d.quality_grade === "D") return 0;
  const cap = offer?.capacity_remaining;
  const hasCap =
    cap !== null && cap !== undefined && Number.isFinite(Number(cap));
  const soldOut = hasCap && Number(cap) <= 0;
  const exclusive = Boolean(
    d.exclusive || offer?.exclusive || d.offer_origin === "perkdrop_exclusive",
  );
  const merchantControlled = Boolean(offer);
  const action = String(offer?.action_type || "");
  const liveClaim =
    merchantControlled &&
    [
      "booking_claim",
      "redemption_code",
      "in_store_claim",
      "free_claim",
    ].includes(action);
  const directLimited = merchantControlled && hasCap;
  const partner =
    merchant?.listing_status === "partner" ||
    (merchant?.partner_tier && merchant.partner_tier !== "none");
  const verified = ["verified", "claimed"].includes(
    String(merchant?.listing_status || ""),
  );
  const campaign = Boolean(
    d.featured ||
    campaignDrops.has(d.id) ||
    (offer && campaignOffers.has(offer.id)),
  );
  if (
    !soldOut &&
    merchantControlled &&
    (exclusive || directLimited || liveClaim)
  )
    return 600;
  if (!soldOut && exclusive) return 560;
  if (!soldOut && merchantControlled) return 520;
  if (!soldOut && partner) return 430;
  if (!soldOut && verified && d.offer_origin === "merchant_submitted")
    return 400;
  if (campaign) return 320;
  if (Boolean(d.hot)) return 220;
  if (soldOut && merchantControlled) return 80;
  return 100;
}
Deno.serve(async (req) => {
  const started = Date.now();
  const requestId = String(req.headers.get("x-vercel-id") || req.headers.get("x-request-id") || crypto.randomUUID()).slice(0, 180);
  const responseHeaders: Record<string, string> = { ...headers, "x-perkdrop-request-id": requestId };
  if (req.method === "OPTIONS") return new Response("ok", { headers: responseHeaders });
  if (req.method !== "GET")
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 405, headers: responseHeaders },
    );
  const url = new URL(req.url);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  if (url.searchParams.get("health") === "1") {
    const healthResults = await runQueryWaves([
      () => queryWithRetry(() => supabase
        .from("catalogue_items")
        .select("id", { count: "exact", head: true })
        .eq("active", true)
        .or(`end_date.is.null,end_date.gte.${today}`)),
      () => queryWithRetry(() => supabase
        .from("catalogue_locations")
        .select("id", { count: "exact", head: true })
        .eq("active", true)),
      () => queryWithRetry(() => supabase.from("merchants").select("id", { count: "exact", head: true })),
    ], 1);
    const [
      { count, error },
      { count: locationCount, error: locationError },
      { count: merchantCount, error: merchantCountError },
    ] = healthResults;
    const healthFailures = [
      { name: "catalogue_items", error },
      { name: "catalogue_locations", error: locationError },
      { name: "merchants", error: merchantCountError },
    ].filter((x) => x.error);
    if (healthFailures.length) {
      const failed = healthFailures.map((x) => x.name);
      const failureStatus = healthFailures.map((x) => `${x.name}:${queryErrorLabel(x.error)}`);
      responseHeaders["x-perkdrop-query-failure"] = failed.join(",");
      responseHeaders["x-perkdrop-query-status"] = failureStatus.join(",");
      responseHeaders["x-perkdrop-query-ms"] = String(Date.now() - started);
      await recordFailure(supabase, requestId, "health", failed, failureStatus, Date.now() - started);
      console.warn(JSON.stringify({ msg: "catalogue_health_query_failed", requestId, failed, failureStatus, ms: Date.now() - started }));
    }
    return new Response(
      JSON.stringify({
        ok: !healthFailures.length,
        service: "perkdrop-catalogue-db",
        version: "v16-priority-live-capacity",
        liveDrops: count || 0,
        multiLocations: locationCount || 0,
        merchants: merchantCount || 0,
        sourceOfTruth: "supabase",
      }),
      { status: healthFailures.length ? 500 : 200, headers: responseHeaders },
    );
  }
  const q = (url.searchParams.get("q") || "").trim().toLowerCase(),
    city = (url.searchParams.get("city") || "").trim().toLowerCase(),
    category = (url.searchParams.get("category") || "").trim().toLowerCase(),
    vertical = (url.searchParams.get("vertical") || "").trim().toLowerCase(),
    kind = (url.searchParams.get("kind") || "").trim().toLowerCase(),
    ids = (url.searchParams.get("id") || "").trim(),
    requestedSlug = (url.searchParams.get("slug") || "").trim();
  // Missing/invalid detail slugs should not fan out into every catalogue
  // dependency. Keep a cheap, bounded index read ahead of the enrichment
  // path; valid base and multi-location slugs continue through the existing
  // visibility, expiry and offer/session safeguards below.
  if (requestedSlug) {
    const slugIndex = await queryWithRetry(() => supabase
      .from("catalogue_items")
      .select("id,slug,detail_url")
      .limit(1000));
    if (slugIndex.error) {
      const status = queryErrorLabel(slugIndex.error);
      responseHeaders["x-perkdrop-query-failure"] = "catalogue_items";
      responseHeaders["x-perkdrop-query-status"] = `catalogue_items:${status}`;
      responseHeaders["x-perkdrop-query-ms"] = String(Date.now() - started);
      await recordFailure(supabase, requestId, "slug", ["catalogue_items"], [status], Date.now() - started);
      console.warn(JSON.stringify({ msg: "catalogue_slug_preflight_failed", requestId, failureStatus: status, ms: Date.now() - started }));
      return new Response(JSON.stringify({ ok: false, error: "catalogue_failed" }), { status: 503, headers: responseHeaders });
    }
    const requestedPath = `/deals/${requestedSlug}`;
    const known = (slugIndex.data || []).some((row: any) =>
      row.slug === requestedSlug ||
      row.detail_url === requestedPath ||
      (row.slug && requestedSlug.startsWith(`${row.slug}-`)),
    );
    if (!known) {
      responseHeaders["x-perkdrop-slug-preflight"] = "miss";
      return new Response(JSON.stringify({ ok: false, status: "not_found", deal: null }), { status: 404, headers: responseHeaders });
    }
    responseHeaders["x-perkdrop-slug-preflight"] = "hit";
  }
  const limit = Math.max(
    1,
    Math.min(200, Number(url.searchParams.get("limit") || 200) || 200),
  );
  const [
    { data, error },
    { data: locations, error: locError },
    { data: merchants, error: merchantError },
    { data: offers, error: offerError },
    { data: campaigns, error: campaignError },
    { data: sessions, error: sessionError },
  ] = await runQueryWaves([
    () => queryWithRetry(() => supabase
      .from("catalogue_items")
      .select(
        "availability,quality_grade,quality_note,last_verified_at,id,merchant_id,merchant,title,description,category,kind,city,state,location,timing,end_date,ends_at,price,conditions,booking,source,verified,hot,featured,slug,detail_url,city_label,active,metadata,latitude,longitude,image_url,image_alt,cuisine,discount_percent,venue_type,offer_origin,exclusive,affiliate_url,affiliate_network",
      )
      .eq("active", true)
      // Exclude stale rows before the limit; the per-state local-day check
      // below remains the final guard for offers ending today.
      .or(`end_date.is.null,end_date.gte.${today}`)
      .order("featured", { ascending: false })
      .order("hot", { ascending: false })
      .order("end_date", { ascending: true, nullsFirst: false })
      .limit(200)),
    () => queryWithRetry(() => supabase
      .from("catalogue_locations")
      .select(
        "id,drop_id,name,address,city,state,latitude,longitude,is_primary,verified_at,source_url,metadata",
      )
      .eq("active", true)
      .limit(1000)),
    () => queryWithRetry(() => supabase
      .from("merchants")
      .select(
        "id,name,slug,listing_status,partner_tier,claimable,verified_at,partner_since,description,cuisine,venue_type,website_url,booking_url,public_phone,public_email,logo_url,hero_image_url,image_rights_status,opening_hours,facilities,permanent_listing,directory_status",
      )),
    () => queryWithRetry(() => supabase
      .from("merchant_offers")
      .select(
        "id,merchant_id,published_drop_id,status,exclusive,featured,vertical,drop_type,inventory_unit,fulfilment_mode,booking_provider,visibility,capacity_total,capacity_remaining,starts_at,ends_at,booking_url,action_type,promo_code,affiliate_url",
      )
      .eq("status", "active")
      .eq("visibility", "public")
      .or(`ends_at.is.null,ends_at.gt.${now}`)
      .limit(1000)),
    () => queryWithRetry(() => supabase
      .from("featured_campaigns")
      .select(
        "id,merchant_id,merchant_offer_id,catalogue_item_id,placement,status,starts_at,ends_at",
      )
      .eq("status", "active")
      .lte("starts_at", now)
      .gte("ends_at", now)
      .limit(500)),
    () => queryWithRetry(() => supabase
      .from("offer_sessions")
      .select(
        "id,merchant_offer_id,service_date,timezone,service_start,service_end,capacity_total,capacity_remaining,status",
      )
      .eq("status", "active")
      .order("service_date", { ascending: true })
      .limit(3000)),
  ], 2);
  if (error || merchantError || offerError || locError || campaignError || sessionError) {
    const failures = [
      { name: "catalogue_items", error },
      { name: "merchants", error: merchantError },
      { name: "merchant_offers", error: offerError },
      { name: "catalogue_locations", error: locError },
      { name: "featured_campaigns", error: campaignError },
      { name: "offer_sessions", error: sessionError },
    ].filter((x) => x.error);
    const failed = failures.map((x) => x.name);
    const failureStatus = failures.map((x) => `${x.name}:${queryErrorLabel(x.error)}`);
    responseHeaders["x-perkdrop-query-failure"] = failed.join(",");
    responseHeaders["x-perkdrop-query-status"] = failureStatus.join(",");
    responseHeaders["x-perkdrop-query-ms"] = String(Date.now() - started);
    await recordFailure(supabase, requestId, "catalogue", failed, failureStatus, Date.now() - started);
    console.warn(JSON.stringify({ msg: "catalogue_query_failed", requestId, failed, failureStatus, ms: Date.now() - started }));
    return new Response(
      JSON.stringify({ ok: false, error: "catalogue_failed" }),
      { status: 500, headers: responseHeaders },
    );
  }
  const merchantMap = new Map((merchants || []).map((m: any) => [m.id, m]));
  const offerByDrop = new Map<string, any>();
  for (const o of offers || [])
    if (o.published_drop_id) offerByDrop.set(o.published_drop_id, o);
  const sessionsByOffer = new Map<string, any[]>();
  for (const s of sessions || []) {
    const arr = sessionsByOffer.get(s.merchant_offer_id) || [];
    arr.push(s);
    sessionsByOffer.set(s.merchant_offer_id, arr);
  }
  const nextSessionByOffer = new Map<string, any>();
  for (const o of offers || []) {
    const upcoming = (sessionsByOffer.get(o.id) || []).filter(
      isUpcomingSession,
    );
    const nextOpen =
      upcoming.find((s: any) => Number(s.capacity_remaining) > 0) ||
      upcoming[0] ||
      null;
    if (nextOpen) nextSessionByOffer.set(o.id, nextOpen);
  }
  const effectiveOffer = (o: any) => {
    if (!o) return null;
    const s = nextSessionByOffer.get(o.id) || null;
    if (o.action_type === "booking_claim" && s)
      return {
        ...o,
        capacity_total: s.capacity_total,
        capacity_remaining: s.capacity_remaining,
        next_session: s,
      };
    return o;
  };
  const campaignDrops = new Set(
    (campaigns || []).map((c: any) => c.catalogue_item_id).filter(Boolean),
  );
  const campaignOffers = new Set(
    (campaigns || []).map((c: any) => c.merchant_offer_id).filter(Boolean),
  );
  const locByDrop = new Map<string, any[]>();
  if (!locError)
    for (const l of locations || []) {
      const arr = locByDrop.get(l.drop_id) || [];
      arr.push(l);
      locByDrop.set(l.drop_id, arr);
    }
  let list: any[] = [];
  for (const d of data || []) {
    if (d.merchant_id && !directoryVisible(merchantMap.get(d.merchant_id))) continue;
    if (d.end_date && String(d.end_date) < localDay(d.state)) continue;
    if (eventEnded(d, new Date(now))) continue;
    const locs = locByDrop.get(d.id) || [];
    if (
      String(d.city || "").toLowerCase() === "australia-wide" &&
      locs.length
    ) {
      for (const l of locs) {
        const suffix = String(l.city || "")
          .toLowerCase()
          .replace(/[^a-z0-9-]/g, "-");
        list.push({
          ...d,
          city: l.city,
          state: l.state || d.state,
          location: l.address,
          latitude: l.latitude == null ? null : Number(l.latitude),
          longitude: l.longitude == null ? null : Number(l.longitude),
          city_label: cityLabel(l.city),
          slug: `${d.slug || d.id.toLowerCase()}-${suffix}`,
          detail_url: `/deals/${d.slug || d.id.toLowerCase()}-${suffix}`,
          metadata: {
            ...(d.metadata || {}),
            multi_location_parent: true,
            location_name: l.name || "",
            location_source_url: l.source_url || "",
            location_verified_at: l.verified_at || "",
          },
        });
      }
    } else list.push(d);
  }
  if (ids) list = list.filter((d: any) => d.id === ids);
  if (city)
    list = list.filter((d: any) => String(d.city || "").toLowerCase() === city);
  if (category)
    list = list.filter(
      (d: any) => String(d.category || "").toLowerCase() === category,
    );
  if (vertical)
    list = list.filter(
      (d: any) =>
        String(
          (offerByDrop.get(d.id) || {}).vertical ||
            d.metadata?.vertical ||
            "other",
        ).toLowerCase() === vertical,
    );
  if (kind)
    list = list.filter((d: any) => String(d.kind || "").toLowerCase() === kind);
  if (q)
    list = list.filter((d: any) => {
      const m = merchantMap.get(d.merchant_id) || {};
      return [
        d.merchant,
        m.name,
        d.title,
        d.description,
        d.location,
        d.city_label,
        d.cuisine,
        m.cuisine,
        d.venue_type,
        m.venue_type,
        d.metadata?.location_name,
        d.metadata?.vertical,
      ].some((v: any) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      );
    });
  list.sort((a: any, b: any) => {
    const ao = effectiveOffer(offerByDrop.get(a.id)),
      bo = effectiveOffer(offerByDrop.get(b.id)),
      am = merchantMap.get(a.merchant_id) || {},
      bm = merchantMap.get(b.merchant_id) || {};
    const ap = priorityScore(a, ao, am, campaignDrops, campaignOffers),
      bp = priorityScore(b, bo, bm, campaignDrops, campaignOffers);
    if (ap !== bp) return bp - ap;
    const ac = ao?.capacity_remaining,
      bc = bo?.capacity_remaining;
    if (
      ap >= 500 &&
      ac !== null &&
      ac !== undefined &&
      bc !== null &&
      bc !== undefined
    ) {
      const an = Number(ac),
        bn = Number(bc);
      if (an > 0 && bn > 0 && an !== bn) return an - bn;
    }
    const ae = ao?.ends_at || a.end_date,
      be = bo?.ends_at || b.end_date;
    if (ap >= 500 && ae && be) {
      const at = new Date(ae).getTime(),
        bt = new Date(be).getTime();
      if (Number.isFinite(at) && Number.isFinite(bt) && at !== bt)
        return at - bt;
    }
    const af = Boolean(
        a.featured ||
        campaignDrops.has(a.id) ||
        (ao && campaignOffers.has(ao.id)),
      ),
      bf = Boolean(
        b.featured ||
        campaignDrops.has(b.id) ||
        (bo && campaignOffers.has(bo.id)),
      );
    if (af !== bf) return af ? -1 : 1;
    if (Boolean(a.hot) !== Boolean(b.hot)) return a.hot ? -1 : 1;
    return 0;
  });
  if (requestedSlug) {
    list=list.filter(d=>d.slug===requestedSlug||d.detail_url===`/deals/${requestedSlug}`);
    if (!list.length) {
      const {data:past,error:pastError}=await queryWithRetry(() => supabase.from('catalogue_items').select('id,merchant_id,slug,title,merchant,active,end_date,ends_at,kind,state').eq('slug',requestedSlug).maybeSingle());
      if(pastError){await recordFailure(supabase, requestId, "slug", ["catalogue_items"], [queryErrorLabel(pastError)], Date.now() - started);console.warn(JSON.stringify({msg:'catalogue_slug_query_failed',requestId,ms:Date.now()-started}));return new Response(JSON.stringify({ok:false,error:'catalogue_failed'}),{status:503,headers:responseHeaders});}
      const visible=past&&(!past.merchant_id||directoryVisible(merchantMap.get(past.merchant_id)));
      const ended=visible&&(!past.active||(past.end_date&&past.end_date<localDay(past.state))||eventEnded(past,new Date(now)));
      return new Response(JSON.stringify({ok:false,status:ended?'ended':'not_found',deal:ended?{title:past.title,merchant:past.merchant,slug:past.slug}:null}),{status:ended?410:404,headers:responseHeaders});
    }
  }
  const total = list.length;
  list = list.slice(0, limit).map((d: any) => {
    const tracked = tracker(d.id);
    const official =
      typeof d.metadata?.original_go_url === "string"
        ? d.metadata.original_go_url
        : "";
    const rawLat =
        d.latitude ?? d.metadata?.lat ?? d.metadata?.latitude ?? null,
      rawLng = d.longitude ?? d.metadata?.lng ?? d.metadata?.longitude ?? null;
    const latitude = rawLat === null || rawLat === "" ? null : Number(rawLat),
      longitude = rawLng === null || rawLng === "" ? null : Number(rawLng);
    const validLat = isAustralianPoint(latitude, longitude) ? latitude : null,
      validLng = isAustralianPoint(latitude, longitude) ? longitude : null;
    const merchant = merchantMap.get(d.merchant_id) || null;
    const cuisine = String(d.cuisine || merchant?.cuisine || "").trim(),
      baseTiming = String(d.timing || "").trim();
    const activeOffer = effectiveOffer(offerByDrop.get(d.id));
    const nextSession = activeOffer?.next_session || null;
    const verticalName = String(
      activeOffer?.vertical || d.metadata?.vertical || categoryVertical(d.category),
    ).toLowerCase();
    const dropType = String(
      activeOffer?.drop_type || d.metadata?.drop_type || "capacity",
    ).toLowerCase();
    const inventoryUnit = String(
      activeOffer?.inventory_unit ||
        (isFoodLike(d, merchant) ? "diner" : "person"),
    ).toLowerCase();
    let timing = cuisine
      ? baseTiming
        ? `${cuisine} · ${baseTiming}`
        : cuisine
      : baseTiming;
    if (
      activeOffer &&
      activeOffer.capacity_remaining !== null &&
      activeOffer.capacity_remaining !== undefined
    ) {
      const n = Math.max(0, Number(activeOffer.capacity_remaining) || 0);
      const label = unitLabel(inventoryUnit, isFoodLike(d, merchant));
      const live =
        n <= 0
          ? "SOLD OUT"
          : n === 1
            ? `1 ${label} LEFT`
            : `${n} ${label} LEFT`;
      const when = nextSession ? sessionLabel(nextSession) : "";
      const suffix = [when, live].filter(Boolean).join(" · ");
      timing = timing ? `${timing} · ${suffix}` : suffix;
    }
    const commercialFeatured = Boolean(
      d.featured ||
      campaignDrops.has(d.id) ||
      (activeOffer && campaignOffers.has(activeOffer.id)),
    );
    const partnerTier = merchant?.partner_tier || "none",
      listingStatus = merchant?.listing_status || "unclaimed";
    const exclusive = Boolean(
      d.exclusive || activeOffer?.exclusive || dropType === "exclusive",
    );
    const state = publicState(listingStatus, partnerTier, exclusive);
    const claimable =
      Boolean(merchant?.claimable) && listingStatus === "unclaimed";
    const merchantSlug = merchant?.slug || "";
    const claimUrl = claimable && merchantSlug ? portal(merchantSlug) : "";
    const merchantName = merchant?.name || d.merchant;
    return {
      id: d.id,
      merchantId: d.merchant_id || null,
      merchant: merchantName,
      merchantSlug,
      listingStatus,
      partnerTier,
      isPartner: state.key === "partner" || state.key === "exclusive",
      publicState: state.key,
      publicLabel: state.label,
      publicIcon: state.icon,
      claimable,
      claimCta: claimable ? "Claim this venue" : "",
      claimUrl,
      claimPath: claimUrl,
      title: d.title,
      description: d.description,
      category: d.category || "",
      vertical: verticalName,
      dropType,
      inventoryUnit,
      fulfilmentMode: activeOffer?.fulfilment_mode || "information_only",
      bookingProvider: activeOffer?.booking_provider || "",
      kind: d.kind,
      city: d.city,
      state: d.state || "",
      location: d.location || "",
      timing,
      end: d.end_date || "",
      price: d.price || "",
      conditions: d.conditions || "",
      booking: Boolean(d.booking || activeOffer || merchant?.booking_url),
      source: tracked,
      officialSource: official,
      verified: d.verified || "",
      lastVerifiedAt: d.last_verified_at || null,
      offerVerification: activeOffer ? "business_approved" : "public_source",
      availability: d.availability || {},
      qualityGrade: d.quality_grade || "C",
      qualityNote: d.quality_note || "",
      hot: Boolean(d.hot),
      featured: commercialFeatured,
      slug: d.slug,
      detailUrl: d.detail_url,
      goUrl: tracked,
      cityLabel: d.city_label || cityLabel(d.city),
      latitude: validLat,
      longitude: validLng,
      navigationUrl: nav(d, validLat, validLng),
      mapQuery:
        validLat !== null && validLng !== null
          ? `${validLat},${validLng}`
          : d.location || merchantName || "",
      imageUrl: d.metadata?.image_unavailable || d.metadata?.image_review_hold ? "" : approvedImage(d.image_url || (['merchant_authorised','licensed'].includes(merchant?.image_rights_status) ? merchant?.hero_image_url : '')),
      imageAlt: d.image_alt || `${merchantName} — ${d.title}`,
      imageFit: d.metadata?.image_fit === 'contain' ? 'contain' : 'cover',
      imageCredit: d.metadata?.image_provenance ? {caption:d.metadata.image_provenance.caption||'',source:d.metadata.image_provenance.source||'',license:d.metadata.image_provenance.license||'',licenseUrl:d.metadata.image_provenance.licenseUrl||''} : null,
      cuisine,
      discountPercent:
        d.discount_percent === null ? null : Number(d.discount_percent),
      venueType: d.venue_type || merchant?.venue_type || "",
      locationName: d.metadata?.location_name || "",
      multiLocation: Boolean(d.metadata?.multi_location_parent),
      offerOrigin: d.offer_origin || "public_source",
      exclusive,
      affiliateUrl: d.affiliate_url || "",
      affiliateNetwork: d.affiliate_network || "",
      merchantOfferId: activeOffer?.id || null,
      actionType: activeOffer?.action_type || "information_only",
      redemptionAvailable: Boolean(
        activeOffer &&
        ["redemption_code", "in_store_claim", "free_claim"].includes(
          activeOffer.action_type || "redemption_code",
        ),
      ),
      capacityTotal: activeOffer?.capacity_total ?? null,
      capacityRemaining: activeOffer?.capacity_remaining ?? null,
      offerStartsAt: activeOffer?.starts_at || null,
      offerEndsAt: activeOffer?.ends_at || null,
      offerServiceDate: nextSession?.service_date || null,
      offerServiceStart: nextSession?.service_start || null,
      offerServiceEnd: nextSession?.service_end || null,
      merchantBookingUrl:
        activeOffer?.booking_url || merchant?.booking_url || "",
      merchantProfile: {
        description: merchant?.description || "",
        websiteUrl: merchant?.website_url || "",
        bookingUrl: merchant?.booking_url || "",
        publicPhone: merchant?.public_phone || "",
        publicEmail: merchant?.public_email || "",
        logoUrl: merchant?.logo_url || "",
        openingHours: merchant?.opening_hours || {},
        facilities: merchant?.facilities || [],
      },
    };
  });
  return new Response(
    JSON.stringify({
      apiVersion: 17,
      generatedAt: new Date().toISOString(),
      count: list.length,
      total,
      deals: list,
    }),
    { headers: responseHeaders },
  );
});
