import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const allowedOrigins = new Set([
  "https://perkdrop.au",
  "https://www.perkdrop.au",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
]);

const leadStatuses = new Set([
  "research", "eligible", "contacted", "responded", "claimed",
  "unsubscribed", "suppressed", "invalid",
]);

const json = (body: unknown, status = 200, origin = "") => new Response(
  JSON.stringify(body),
  {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "vary": "Origin",
    },
  },
);

const clean = (value: unknown, max = 500) => String(value ?? "").trim().slice(0, max);
const emailKey = (value: unknown) => clean(value, 320).toLowerCase();
const validEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const slugPart = (value: string) => value.toLowerCase().normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-")
  .replace(/^-|-$/g, "").slice(0, 54) || "merchant";

function requestOrigin(req: Request) {
  const origin = req.headers.get("origin") || "";
  if (!origin) return "https://perkdrop.au";
  if (allowedOrigins.has(origin) || /^https:\/\/perkdrop(?:-[a-z0-9-]+)?\.vercel\.app$/.test(origin)) return origin;
  return "";
}

Deno.serve(async (req) => {
  const origin = requestOrigin(req);
  if (req.headers.get("origin") && !origin) return json({ error: "origin_not_allowed" }, 403, "null");
  if (req.method === "OPTIONS") return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "vary": "Origin",
    },
  });

  const token = req.headers.get("authorization") || "";
  const url = Deno.env.get("SUPABASE_URL")!;
  const auth = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: token } },
  });
  const { data: { user } } = await auth.auth.getUser();
  if (!user) return json({ error: "unauthorized" }, 401, origin);

  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: owner } = await admin.from("admin_users")
    .select("user_id").eq("user_id", user.id).maybeSingle();
  if (!owner) return json({ error: "forbidden" }, 403, origin);

  if (req.method === "POST") {
    let body: Record<string, unknown>;
    try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, origin); }
    const action = clean(body.action, 40);

    if (action === "lead_create") {
      const businessName = clean(body.businessName, 160);
      const state = clean(body.state, 40).toUpperCase();
      const category = clean(body.category, 120);
      const email = emailKey(body.email);
      const status = clean(body.status, 30) || "research";
      if (!businessName || !state || !category || !validEmail(email) || !leadStatuses.has(status)) {
        return json({ error: "invalid_lead" }, 400, origin);
      }

      const { data: emailMatch } = await admin.from("outreach_contacts")
        .select("id").ilike("email", email).limit(1).maybeSingle();
      if (emailMatch) return json({ error: "duplicate_email" }, 409, origin);

      const { data: nameMatches } = await admin.from("merchants")
        .select("id,name,primary_state,do_not_contact")
        .ilike("name", businessName).eq("primary_state", state).limit(10);
      const sameMerchant = (nameMatches || []).find((m) => m.name.trim().toLowerCase() === businessName.toLowerCase());
      if (sameMerchant?.do_not_contact) return json({ error: "suppressed_merchant" }, 409, origin);
      if (sameMerchant) {
        const { data: existingContact } = await admin.from("outreach_contacts")
          .select("id").eq("merchant_id", sameMerchant.id).limit(1).maybeSingle();
        if (existingContact) return json({ error: "duplicate_business" }, 409, origin);
      }

      let merchantId = sameMerchant?.id;
      if (!merchantId) {
        const slug = `${slugPart(businessName)}-${state.toLowerCase()}-${crypto.randomUUID().slice(0, 8)}`;
        const { data: merchant, error: merchantError } = await admin.from("merchants").insert({
          name: businessName,
          slug,
          primary_state: state,
          business_category: category,
          public_email: email,
        }).select("id").single();
        if (merchantError) return json({ error: "merchant_create_failed" }, 500, origin);
        merchantId = merchant.id;
      }

      const { data: contact, error } = await admin.from("outreach_contacts").insert({
        merchant_id: merchantId,
        email,
        source_url: "admin://manual-lead",
        status,
        response: clean(body.response, 2000) || null,
        follow_up_date: clean(body.followUpDate, 10) || null,
        outcome: clean(body.outcome, 500) || null,
        metadata: { created_by: user.id, channel: "owner_dashboard" },
      }).select("id").single();
      if (error?.code === "23505") return json({ error: "duplicate_email" }, 409, origin);
      if (error) return json({ error: "lead_create_failed" }, 500, origin);
      return json({ ok: true, id: contact.id }, 201, origin);
    }

    if (action === "lead_update" || action === "lead_mark_contacted") {
      const id = clean(body.id, 80);
      if (!id) return json({ error: "missing_id" }, 400, origin);
      const { data: current } = await admin.from("outreach_contacts")
        .select("id,merchant_id,email,contact_count,first_contacted_at").eq("id", id).maybeSingle();
      if (!current) return json({ error: "lead_not_found" }, 404, origin);

      if (action === "lead_mark_contacted") {
        const now = new Date().toISOString();
        const { error } = await admin.from("outreach_contacts").update({
          status: "contacted",
          first_contacted_at: current.first_contacted_at || now,
          last_contacted_at: now,
          contact_count: Number(current.contact_count || 0) + 1,
          response: clean(body.response, 2000) || null,
          follow_up_date: clean(body.followUpDate, 10) || null,
          outcome: clean(body.outcome, 500) || null,
        }).eq("id", id);
        if (error) return json({ error: "lead_update_failed" }, 500, origin);
        return json({ ok: true }, 200, origin);
      }

      const businessName = clean(body.businessName, 160);
      const state = clean(body.state, 40).toUpperCase();
      const category = clean(body.category, 120);
      const email = emailKey(body.email);
      const status = clean(body.status, 30);
      if (!businessName || !state || !category || !validEmail(email) || !leadStatuses.has(status)) {
        return json({ error: "invalid_lead" }, 400, origin);
      }
      if (email !== emailKey(current.email)) {
        const { data: emailMatch } = await admin.from("outreach_contacts")
          .select("id").ilike("email", email).neq("id", id).limit(1).maybeSingle();
        if (emailMatch) return json({ error: "duplicate_email" }, 409, origin);
      }

      const { error: contactError } = await admin.from("outreach_contacts").update({
        email,
        status,
        response: clean(body.response, 2000) || null,
        follow_up_date: clean(body.followUpDate, 10) || null,
        outcome: clean(body.outcome, 500) || null,
      }).eq("id", id);
      if (contactError?.code === "23505") return json({ error: "duplicate_email" }, 409, origin);
      if (contactError) return json({ error: "lead_update_failed" }, 500, origin);

      const { error: merchantError } = await admin.from("merchants").update({
        name: businessName,
        primary_state: state,
        business_category: category,
        public_email: email,
      }).eq("id", current.merchant_id);
      if (merchantError) return json({ error: "merchant_update_failed" }, 500, origin);
      return json({ ok: true }, 200, origin);
    }
    return json({ error: "unsupported_action" }, 400, origin);
  }

  if (req.method !== "GET") return json({ error: "method_not_allowed" }, 405, origin);

  const days = Math.min(90, Math.max(1, Number(new URL(req.url).searchParams.get("days") || 7)));
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const [eventsResult, redemptionResult, claimsResult, dropsResult, offersResult, contactsResult] = await Promise.all([
    admin.from("engagement_events")
      .select("event_type,catalogue_item_id,city,metadata,session_id,created_at")
      .gte("created_at", since).order("created_at", { ascending: false }).limit(20000),
    admin.from("redemptions")
      .select("id,catalogue_item_id,merchant_offer_id,party_size,status,created_at")
      .gte("created_at", since).limit(10000),
    admin.from("merchant_claims").select("id,status,created_at").gte("created_at", since).limit(10000),
    admin.from("catalogue_items").select("id,title,merchant,city,active,lifecycle_status,end_date"),
    admin.from("merchant_offers").select("id,status,capacity_total,capacity_remaining,published_drop_id"),
    admin.from("outreach_contacts")
      .select("id,email,status,first_contacted_at,last_contacted_at,contact_count,response,follow_up_date,outcome,created_at,merchant_id,merchants:merchant_id(name,primary_state,business_category)")
      .order("created_at", { ascending: false }).limit(2000),
  ]);
  const queryError = [eventsResult, redemptionResult, claimsResult, dropsResult, offersResult, contactsResult].find((x) => x.error)?.error;
  if (queryError) return json({ error: "analytics_unavailable" }, 500, origin);

  const events = eventsResult.data || [];
  const redemptions = redemptionResult.data || [];
  const claims = claimsResult.data || [];
  const drops = dropsResult.data || [];
  const offers = offersResult.data || [];
  const contacts = contactsResult.data || [];
  const isEvent = (x: any, ...names: string[]) => names.includes(String(x.event_type || ""));
  const eventCount = (...names: string[]) => events.filter((x) => isEvent(x, ...names)).length;
  const countBy = (key: (x: any) => unknown) => Object.entries(events.reduce((acc: Record<string, number>, x: any) => {
    const raw = key(x); if (raw === null || raw === undefined || raw === "") return acc;
    const value = String(raw); acc[value] = (acc[value] || 0) + 1; return acc;
  }, {})).map(([name, count]) => ({ name, count })).sort((a: any, b: any) => b.count - a.count).slice(0, 10);

  const filledRedemptions = redemptions.filter((row) => ["created", "redeemed"].includes(row.status));
  const seatsFilled = filledRedemptions.reduce((sum, row) => sum + Math.max(1, Number(row.party_size || 1)), 0);
  const activeDrops = drops.filter((d) => d.active && d.lifecycle_status === "active" && (!d.end_date || d.end_date >= today)).length;
  const activeOffers = offers.filter((o) => o.status === "active");
  const capacityTotal = activeOffers.reduce((sum, o) => sum + Math.max(0, Number(o.capacity_total || 0)), 0);
  const capacityRemaining = activeOffers.reduce((sum, o) => sum + Math.max(0, Number(o.capacity_remaining || 0)), 0);

  const funnel: Record<string, any> = {};
  for (const x of events) {
    const source = String(x.metadata?.utm_source || "Direct");
    const row = funnel[source] || (funnel[source] = { source, pageViews: 0, dropOpens: 0, directions: 0, officialClicks: 0, claims: 0 });
    if (isEvent(x, "page_view")) row.pageViews++;
    if (isEvent(x, "deal_open", "deal_view")) row.dropOpens++;
    if (isEvent(x, "directions_click", "directions")) row.directions++;
    if (isEvent(x, "official_deal_click", "website_click")) row.officialClicks++;
    if (isEvent(x, "claim_portal_open", "claim_start")) row.claims++;
  }

  const redemptionByDrop = filledRedemptions.reduce((acc: Record<string, any>, row) => {
    if (!row.catalogue_item_id) return acc;
    const value = acc[row.catalogue_item_id] || (acc[row.catalogue_item_id] = { redemptions: 0, seats: 0 });
    value.redemptions++; value.seats += Math.max(1, Number(row.party_size || 1)); return acc;
  }, {});
  const dealRows: Record<string, any> = {};
  for (const x of events) {
    if (!x.catalogue_item_id) continue;
    const base = drops.find((d) => d.id === x.catalogue_item_id);
    const d = dealRows[x.catalogue_item_id] || (dealRows[x.catalogue_item_id] = {
      id: x.catalogue_item_id,
      deal: base?.title || x.metadata?.deal_slug || x.catalogue_item_id,
      merchant: base?.merchant || x.metadata?.merchant || "",
      city: base?.city || x.city || "",
      views: 0, saves: 0, directions: 0, official: 0,
      redemptions: redemptionByDrop[x.catalogue_item_id]?.redemptions || 0,
      seats: redemptionByDrop[x.catalogue_item_id]?.seats || 0,
    });
    if (isEvent(x, "deal_open", "deal_view")) d.views++;
    if (isEvent(x, "save_toggle", "save")) d.saves++;
    if (isEvent(x, "directions_click", "directions")) d.directions++;
    if (isEvent(x, "official_deal_click", "website_click")) d.official++;
  }
  for (const [dropId, values] of Object.entries(redemptionByDrop)) {
    if (dealRows[dropId]) continue;
    const base = drops.find((d) => d.id === dropId);
    dealRows[dropId] = { id: dropId, deal: base?.title || dropId, merchant: base?.merchant || "", city: base?.city || "", views: 0, saves: 0, directions: 0, official: 0, ...values };
  }
  const deals = Object.values(dealRows).map((d: any) => ({ ...d, estimatedRevenue: d.seats * 3 }))
    .sort((a: any, b: any) => b.views - a.views || b.seats - a.seats).slice(0, 50);

  const leads = contacts.map((contact: any) => {
    const merchant = Array.isArray(contact.merchants) ? contact.merchants[0] : contact.merchants;
    return {
      id: contact.id,
      merchantId: contact.merchant_id,
      businessName: merchant?.name || "",
      state: merchant?.primary_state || "",
      category: merchant?.business_category || "",
      email: contact.email || "",
      status: contact.status,
      firstContactedAt: contact.first_contacted_at,
      lastContactedAt: contact.last_contacted_at,
      contactCount: contact.contact_count || 0,
      response: contact.response || "",
      followUpDate: contact.follow_up_date,
      outcome: contact.outcome || "",
      createdAt: contact.created_at,
    };
  });
  const duplicateLeadEmails = Object.values(contacts.reduce((acc: Record<string, number>, x: any) => {
    const key = emailKey(x.email); if (key) acc[key] = (acc[key] || 0) + 1; return acc;
  }, {})).filter((count) => count > 1).length;

  return json({
    days,
    generatedAt: new Date().toISOString(),
    overview: {
      visitors: new Set(events.map((x) => x.session_id).filter(Boolean)).size,
      pageViews: eventCount("page_view"),
      dealOpens: eventCount("deal_open", "deal_view"),
      redemptions: filledRedemptions.length,
      seatsFilled,
      merchantClaims: claims.length,
      activeDrops,
      estimatedRevenue: seatsFilled * 3,
      searches: eventCount("search"),
      saves: eventCount("save_toggle", "save"),
      directions: eventCount("directions_click", "directions"),
    },
    operations: {
      pendingClaims: claims.filter((x) => ["pending", "submitted"].includes(x.status)).length,
      activeOffers: activeOffers.length,
      capacityTotal,
      capacityRemaining,
      capacityFilled: Math.max(0, capacityTotal - capacityRemaining),
      duplicateLeadEmails,
      followUpsDue: leads.filter((x) => x.followUpDate && x.followUpDate <= today && !["claimed", "unsubscribed", "suppressed", "invalid"].includes(x.status)).length,
    },
    sources: countBy((x: any) => x.metadata?.utm_source),
    funnel: Object.values(funnel).sort((a: any, b: any) => b.pageViews - a.pageViews).slice(0, 10),
    searches: countBy((x: any) => isEvent(x, "search") ? x.metadata?.search_term : null),
    cities: countBy((x: any) => x.city),
    categories: countBy((x: any) => x.metadata?.category),
    deals,
    leads,
  }, 200, origin);
});
