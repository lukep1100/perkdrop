import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { isAustralianPoint, localDay } from "../_shared/discovery.ts";
const H = {
  "content-type": "application/json; charset=utf-8",
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,OPTIONS",
  "cache-control": "public, max-age=30, s-maxage=30",
};
const clean = (v: string | null, max = 160) =>
  String(v || "")
    .trim()
    .slice(0, max);
const validNum = (v: string | null, min: number, max: number) => {
  if (v === null || String(v).trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
function distKm(a: number, b: number, c: number, d: number) {
  const r = Math.PI / 180,
    x =
      0.5 -
      Math.cos((c - a) * r) / 2 +
      (Math.cos(a * r) * Math.cos(c * r) * (1 - Math.cos((d - b) * r))) / 2;
  return 12742 * Math.asin(Math.sqrt(Math.max(0, x)));
}
function publicState(m: any, exclusive: Set<string>) {
  if (exclusive.has(String(m.id))) return "exclusive";
  if (m.listing_status === "partner" || (m.partner_tier && m.partner_tier !== "none"))
    return "partner";
  if (m.listing_status === "verified") return "verified";
  if (m.listing_status === "claim_pending") return "claim_pending";
  return "unclaimed";
}
const labels: any = {
  unclaimed: "UNCLAIMED",
  claim_pending: "CLAIM PENDING",
  verified: "✓ VERIFIED BY BUSINESS",
  partner: "💜 PERKDROP PARTNER",
  exclusive: "🔥 PERKDROP EXCLUSIVE",
};
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: H });
  if (req.method !== "GET")
    return new Response(
      JSON.stringify({ ok: false, error: "method_not_allowed" }),
      { status: 405, headers: H },
    );
  const u = new URL(req.url),
    q = clean(u.searchParams.get("q")).toLowerCase(),
    market = clean(u.searchParams.get("market")).toLowerCase(),
    slug = clean(u.searchParams.get("slug"));
  const lat = validNum(u.searchParams.get("lat"), -90, 90),
    lng = validNum(u.searchParams.get("lng"), -180, 180),
    radius = Math.max(
      1,
      Math.min(200, Number(u.searchParams.get("radiusKm") || 50) || 50),
    );
  const limit = Math.max(
    1,
    Math.min(1000, Number(u.searchParams.get("limit") || 20) || 20),
  );
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  let query = sb
    .from("merchants")
    .select(
      "id,name,slug,listing_status,partner_tier,claimable,market_id,primary_city,primary_state,primary_location,latitude,longitude,business_category,cuisine,venue_type,parent_brand,location_label,website_url,hero_image_url,image_rights_status,directory_status,source_confidence,public_phone,metadata",
    )
    .eq("permanent_listing", true)
    .neq("directory_status", "removed")
    .limit(1200);
  if (slug) query = query.eq("slug", slug);
  const [{ data, error }, { data: xo }, { data: xc }] = await Promise.all([
    query,
    sb
      .from("merchant_offers")
      .select("merchant_id")
      .eq("exclusive", true)
      .eq("status", "active")
      .eq("visibility", "public")
      .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`),
    sb
      .from("catalogue_items")
      .select("merchant_id,end_date,state,exclusive,quality_grade")
      .eq("active", true)
      .not("merchant_id", "is", null),
  ]);
  if (error)
    return new Response(
      JSON.stringify({ ok: false, error: "directory_failed" }),
      { status: 500, headers: H },
    );
  const exclusive = new Set<string>(
    [...(xo || []), ...(xc || []).filter((x: any) => x.exclusive && (!x.end_date || x.end_date >= localDay(x.state)))].map((x: any) => String(x.merchant_id)),
  );
  const useful = new Set((xc||[]).filter((x:any)=>['A','B'].includes(x.quality_grade)&&(!x.end_date||x.end_date>=localDay(x.state))).map((x:any)=>x.merchant_id));
  const offerCounts = new Map<string,number>();for(const x of xc||[])if(!x.end_date||x.end_date>=localDay(x.state))offerCounts.set(x.merchant_id,(offerCounts.get(x.merchant_id)||0)+1);
  const rank=(m:any)=>(useful.has(m.id)?100:0)+(['licensed','merchant_authorised'].includes(m.image_rights_status)&&m.hero_image_url?10:0)+(isAustralianPoint(m.latitude,m.longitude)?2:0);
  let list = (data || []) as any[];
  // Filter using the same fallback returned to clients. Older approved listings
  // can have primary_city set while market_id is still null.
  if (!slug && market && lat === null) list = list.filter(m =>
    String(m.market_id || m.primary_city || '').toLowerCase().replace(/\s+/g, '-') === market.replace(/\s+/g, '-')
  );
  if (q)
    list = list.filter((m) =>
      [
        m.name,
        m.parent_brand,
        m.location_label,
        m.primary_location,
        m.primary_city,
        m.primary_state,
        m.business_category,
        m.cuisine,
        m.venue_type,
      ].some((v) =>
        String(v || "")
          .toLowerCase()
          .includes(q),
      ),
    );
  if (lat !== null && lng !== null) {
    list = list
      .map((m) => ({
        ...m,
        distanceKm:
          isAustralianPoint(m.latitude,m.longitude)
            ? distKm(lat, lng, Number(m.latitude), Number(m.longitude))
            : null,
      }))
      .filter((m) => m.distanceKm !== null && m.distanceKm <= radius)
      .sort(
        (a, b) =>
          a.distanceKm - b.distanceKm ||
          String(a.name).localeCompare(String(b.name)),
      );
  } else
    list = list.sort((a, b) => rank(b)-rank(a)||String(a.name).localeCompare(String(b.name)));
  const total = list.length;
  list = list.slice(0, limit).map((m) => {
    const ps = publicState(m, exclusive);
    // An exclusive offer is not proof that a business owner has claimed access.
    const canClaim = Boolean(m.claimable) && m.listing_status === "unclaimed";
    return {
      id: m.id,
      name: m.name,
      slug: m.slug,
      status: m.listing_status,
      publicState: ps,
      publicLabel: labels[ps],
      partnerTier: m.partner_tier,
      claimable: canClaim,
      claimCta: canClaim ? "Claim this venue" : null,
      market: m.market_id || m.primary_city || "",
      state: m.primary_state || "",
      location: m.primary_location || "",
      latitude: m.latitude,
      longitude: m.longitude,
      distanceKm:
        m.distanceKm == null ? null : Number(Number(m.distanceKm).toFixed(2)),
      category: m.business_category || m.venue_type || m.cuisine || "",
      cuisine: m.cuisine || "",
      venueType: m.venue_type || "",
      brand: m.parent_brand || "",
      locationLabel: m.location_label || "",
      website: m.website_url || "",
      phone: m.public_phone || "",
      activeOfferCount: offerCounts.get(m.id)||0,
      photoCaption: m.metadata?.hero_photo_provenance?.caption || "",
      photoSource: m.metadata?.hero_photo_provenance?.source || "",
      image:
        m.image_rights_status === "merchant_authorised" ||
        m.image_rights_status === "licensed"
          ? m.hero_image_url
          : null,
      imageRightsStatus: m.image_rights_status,
      sourceConfidence: m.source_confidence || "",
      claimUrl: `https://perkdrop.au/claim?merchant=${encodeURIComponent(m.slug)}`,
    };
  });
  return new Response(
    JSON.stringify({
      ok: true,
      count: list.length,
      total,
      mode: lat !== null && lng !== null ? "nearby" : "directory",
      radiusKm: lat !== null && lng !== null ? radius : null,
      businesses: list,
    }),
    { headers: H },
  );
});
