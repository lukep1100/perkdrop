import { availabilityMatches, freshness, scheduleLabel, selectedAvailability, localClock } from '/availability.mjs?v=v33-local-pilot';
import { PLACEHOLDER, validCoordinates, safeImage, isUnconditionallyFree, fulfilmentLabel, localDate, searchMatches } from '/discovery-rules.mjs?v=v33-local-pilot';
(() => {
  "use strict";
  const VERSION = "v33-local-pilot";
  const API =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200";
  const SUBMIT =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-merchant-submit";
  const TRACK =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-track";
  const REDEEM =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-redeem";
  const UNION = "/deals/union-hotel-20-off-lunch";
  const CITIES = {
    adelaide: ["Adelaide", "SA", -34.9285, 138.6007],
    sydney: ["Sydney", "NSW", -33.8688, 151.2093],
    melbourne: ["Melbourne", "VIC", -37.8136, 144.9631],
    brisbane: ["Brisbane", "QLD", -27.4698, 153.0251],
    perth: ["Perth", "WA", -31.9523, 115.8613],
    darwin: ["Darwin", "NT", -12.4634, 130.8456],
    canberra: ["Canberra", "ACT", -35.2809, 149.13],
    hobart: ["Hobart", "TAS", -42.8821, 147.3272],
    "gold-coast": ["Gold Coast", "QLD", -28.0167, 153.4],
  };
  const store = {
    get(k, d = "") {
      try {
        return localStorage.getItem(k) ?? d;
      } catch {
        return d;
      }
    },
    json(k, d) {
      try {
        const v = localStorage.getItem(k);
        return v ? JSON.parse(v) : d;
      } catch {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem(k, v);
      } catch {}
    },
  };
  const qs = new URLSearchParams(location.search);
  const traffic = {
    source: (qs.get("utm_source") || "").toLowerCase(),
    medium: (qs.get("utm_medium") || "").toLowerCase(),
    campaign: qs.get("utm_campaign") || "",
    fbclid: qs.get("fbclid") || "",
  };
  try { const prior=JSON.parse(sessionStorage.getItem("perkdrop_attribution")||"{}");if(!traffic.source&&prior.source)Object.assign(traffic,prior); } catch {}
  if (!traffic.source) {
    const r = document.referrer.toLowerCase();
    traffic.source = /facebook|fb\./.test(r)
      ? "facebook"
      : /instagram/.test(r)
        ? "instagram"
        : /tiktok/.test(r)
          ? "tiktok"
          : /google\./.test(r)
            ? "google"
            : r
              ? "referral"
              : "direct";
  }
  try {sessionStorage.setItem("perkdrop_attribution",JSON.stringify(traffic));}catch{}
  const sid = (() => {
    let v = store.get("perkdrop_analytics_session");
    if (!v) {
      v =
        crypto.randomUUID?.() ||
        Date.now() + "-" + Math.random().toString(36).slice(2);
      store.set("perkdrop_analytics_session", v);
    }
    return v;
  })();
  const state = {
    deals: [],
    businesses: [],
    directoryLoaded: false,
    directoryLoading: false,
    directoryError: "",
    mapFilter: "all",
    detailMap: null,
    viewedDeal: "",
    viewedMap: "",
    city: CITIES[store.get("perkdrop_city")] ? store.get("perkdrop_city") : "adelaide",
    user: null,
    saved: store.json("perkdrop_saved", []),
    redemptions: store.json("perkdrop_redemptions", {}),
    route: location.pathname,
    query: qs.get("q") || "",
    loading: true,
    error: "",
    map: null,
    party: 1,
    locationOpen: false,
    pageKey: "",
  };
  const $ = (s) => document.querySelector(s),
    $$ = (s) => [...document.querySelectorAll(s)];
  const esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const clean = (s) => String(s || "").trim();
  function track(event_type, metadata = {}) {
    try {
      fetch(TRACK, {
        method: "POST",
        headers: { "content-type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          event_type,
          session_id: sid,
          city: state.city,
          source_page: location.pathname + location.search,
          referrer: document.referrer,
          metadata: {
            ...metadata,
            utm_source: traffic.source || null,
            utm_medium: traffic.medium || null,
            utm_campaign: traffic.campaign || null,
            fbclid: traffic.fbclid || null,
            path: location.pathname + location.search,
          },
        }),
      }).catch(() => {});
    } catch {}
  }
  function trackPage() {
    const k = location.pathname + location.search;
    if (state.pageKey === k) return;
    state.pageKey = k;
    const d = dealFromRoute();
    track("page_view", d ? props(d) : {});
  }
  function norm(xs) {
    return (xs || []).map((x) => ({
      ...x,
      id: String(x.id || ""),
      slug: x.slug || String(x.id || "").toLowerCase(),
      detailUrl: x.detailUrl || x.detail_url || "",
      merchant: x.merchant || "",
      title: x.title || "",
      description: x.description || "",
      category: x.category || "",
      kind: x.kind || "",
      city: x.city || "",
      location: x.location || "",
      timing: x.timing || "",
      end: x.end || "",
      price: x.price || "",
      conditions: x.conditions || "",
      source: x.source || "",
      officialSource: x.officialSource || x.official_source || "",
      goUrl: x.goUrl || x.go_url || "",
      imageUrl: x.imageUrl || x.image_url || "",
      imageAlt: x.imageAlt || x.image_alt || "",
      imageCredit: x.imageCredit || null,
      imageFit: x.imageFit === 'contain' ? 'contain' : 'cover',
      cuisine: x.cuisine || "",
      venueType: x.venueType || x.venue_type || "",
      discountPercent: x.discountPercent ?? x.discount_percent ?? null,
      latitude: x.latitude == null ? null : Number(x.latitude),
      longitude: x.longitude == null ? null : Number(x.longitude),
      navigationUrl: x.navigationUrl || x.navigation_url || "",
      merchantId: x.merchantId || x.merchant_id || "",
      listingStatus: x.listingStatus || x.listing_status || "unclaimed",
      partnerTier: x.partnerTier || x.partner_tier || "none",
      isPartner: Boolean(x.isPartner || x.is_partner),
      publicState: x.publicState || x.public_state || "",
      publicLabel: x.publicLabel || x.public_label || "",
      claimable: x.claimable !== false,
      claimUrl: x.claimUrl || x.claim_url || x.claimPath || x.claim_path || "",
      exclusive: Boolean(x.exclusive),
      offerOrigin: x.offerOrigin || x.offer_origin || "public_source",
      merchantOfferId: x.merchantOfferId || x.merchant_offer_id || "",
      redemptionAvailable: Boolean(
        x.redemptionAvailable || x.redemption_available,
      ),
      capacityTotal: x.capacityTotal ?? x.capacity_total ?? null,
      capacityRemaining: x.capacityRemaining ?? x.capacity_remaining ?? null,
      offerStartsAt: x.offerStartsAt || x.offer_starts_at || "",
      offerEndsAt: x.offerEndsAt || x.offer_ends_at || "",
      merchantBookingUrl: x.merchantBookingUrl || x.merchant_booking_url || "",
      actionType: x.actionType || x.action_type || "redemption_code",
    }));
  }
  const UNIT_LABELS = {
    diner: "DINERS",
    person: "PEOPLE",
    ticket: "TICKETS",
    appointment: "APPOINTMENTS",
    booking: "BOOKINGS",
    room: "ROOMS",
    tee_time: "PLAYER SPOTS",
    class_spot: "CLASS SPOTS",
    player: "PLAYERS",
    seat: "SEATS",
    item: "ITEMS",
    package: "PACKAGES",
    other: "UNITS",
  };
  function unitLabel(d) {
    return UNIT_LABELS[d.inventoryUnit] || "UNITS";
  }
  function enrich(d) {
    const vertical =
        String(d.vertical || d.metadata?.vertical || "").toLowerCase() ||
        "other",
      dropType = String(
        d.dropType || d.drop_type || d.metadata?.drop_type || "capacity",
      ).toLowerCase(),
      inventoryUnit = String(
        d.inventoryUnit || d.inventory_unit || "person",
      ).toLowerCase();
    const e = {
      ...d,
      vertical,
      dropType,
      inventoryUnit,
      fulfilmentMode: d.fulfilmentMode || d.fulfilment_mode || (d.redemptionAvailable ? "direct_claim" : "information_only"),
      bookingProvider: d.bookingProvider || d.booking_provider || "",
    };
    const n = e.capacityRemaining == null ? null : Number(e.capacityRemaining);
    const urgency =
      n == null
        ? dropType === "cancellation"
          ? "⚡ CANCELLATION DROP"
          : dropType === "last_minute"
            ? "⚡ LAST MINUTE"
            : ""
        : n <= 0
          ? "SOLD OUT"
          : n <= 3
            ? `🔥 ONLY ${n} ${unitLabel(e)} LEFT`
            : n <= 8
              ? `LIMITED — ${n} ${unitLabel(e)} LEFT`
              : dropType === "cancellation"
                ? "⚡ CANCELLATION DROP"
                : dropType === "last_minute"
                  ? "⚡ LAST MINUTE"
                  : "";
    return {
      ...e,
      urgency,
      verticalLabel: vertical.charAt(0).toUpperCase() + vertical.slice(1),
      timing: [e.timing, urgency].filter(Boolean).join(" · "),
    };
  }
  function text(d) {
    return `${d.title} ${d.merchant} ${d.description} ${d.location} ${d.category} ${d.kind} ${d.cuisine} ${d.venueType} ${d.timing}`.toLowerCase();
  }
  const isFood = (d) =>
    /\b(food|restaurant|burgers?|pizzas?|schnitzels?|meals?|caf[eé]|dining|pasta|kitchen|bakery|seafood|eat)\b/.test(
      text(d),
    );
  const isDrink = (d) =>
    /drink|cocktail|bar|pub|beer|wine|happy hour|hotel pub/.test(text(d));
  const isEvent = (d) =>
    String(d.kind).toLowerCase() === "event" ||
    /event|festival|exhibition|market|concert|performance|show|cinema/.test(
      text(d),
    );
  const isFree = isUnconditionallyFree;
  const isKids = (d) =>
    /kids|children|child|family|families|junior/.test(text(d));
  const isShopping = (d) =>
    /shopping|retail|fashion|store|mall|shirt|glasses/.test(text(d));
  function type(d) {
    const map = {
      food: ["food", "🍴", "Food"],
      drinks: ["drinks", "🍸", "Drinks"],
      events: ["event", "★", "Events"],
      beauty: ["beauty", "✂", "Beauty"],
      wellness: ["wellness", "◌", "Wellness"],
      hair: ["hair", "✂", "Hair"],
      experiences: ["experience", "✦", "Experiences"],
      activities: ["activities", "⛳", "Activities"],
      fitness: ["activities", "◉", "Fitness"],
      golf: ["golf", "⛳", "Golf"],
      tourism: ["tourism", "⌖", "Tourism"],
      stay: ["stay", "⌂", "Stay"],
      shopping: ["shopping", "◆", "Shopping"],
      free: ["free", "$0", "Free"],
      services: ["services", "◆", "Services"],
      other: ["experience", "✦", "Drop"],
    };
    return (
      (d.vertical !== "other" && map[d.vertical]) ||
      (isEvent(d) && ["event", "★", "Events"]) ||
      (isDrink(d) && ["drinks", "🍸", "Drinks"]) ||
      (isFood(d) && ["food", "🍴", "Food"]) || ["experience", "✦", "Drop"]
    );
  }
  const mapped = d => validCoordinates(d.latitude, d.longitude);
  const image = d => {
    let source=safeImage(d.imageUrl);
    if(source.includes('/functions/v1/perkdrop-union-slideshow'))source='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-union-slideshow?still=1';
    if(source.startsWith('https://www.datocms-assets.com/88015/')||source.startsWith('https://hota.com.au/uploads/')||source.endsWith('/perkdrop-union-slideshow?still=1'))return '/_next/image?url='+encodeURIComponent(source)+'&w=828&q=75';
    return source;
  };
  const badge = (d) =>
    d.discountPercent != null && Number.isFinite(Number(d.discountPercent))
      ? `${Math.round(Number(d.discountPercent))}% OFF`
      : d.price || (isFree(d) ? "FREE" : "DROP");
  function mState(d) {
    const r = String(d.publicState || "").toLowerCase(),
      l = String(d.listingStatus || "").toLowerCase(),
      t = String(d.partnerTier || "").toLowerCase();
    if (d.exclusive || r.includes("exclusive")) return "exclusive";
    if (
      d.isPartner ||
      r.includes("partner") ||
      l === "partner" ||
      (t && t !== "none" && t !== "unclaimed")
    )
      return "partner";
    if (r.includes("verified") || l === "verified" || l === "claimed")
      return "verified";
    if (r.includes("pending") || l.includes("pending")) return "pending";
    return "unclaimed";
  }
  function mBadge(d) {
    if(d.offerVerification==='business_approved')return '<span class="merchant-status status-verified">BUSINESS-APPROVED OFFER</span>';
    const s = mState(d),
      label =
        s === "exclusive"
          ? "🔥 PERKDROP EXCLUSIVE"
          : s === "partner"
            ? "💜 PERKDROP PARTNER"
            : s === "verified"
              ? "✓ VERIFIED BUSINESS"
              : s === "pending"
                ? "CLAIM PENDING"
                : "PUBLIC-SOURCE OFFER";
    return `<span class="merchant-status status-${s}">${label}</span>`;
  }
  function route(d) {
    const target = String(d?.detailUrl || d?.slug || d?.id || "").trim();
    return target
      ? target.startsWith("/")
        ? target
        : `/deals/${encodeURIComponent(target)}`
      : "/food";
  }
  function navUrl(d) {
    if (d.navigationUrl) return d.navigationUrl;
    const dest = mapped(d)
      ? `${d.latitude},${d.longitude}`
      : d.location || d.merchant;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
  }
  function props(d, extra = {}) {
    return {
      deal_id: d.id,
      deal_slug: d.slug,
      merchant: clean(d.merchant).slice(0, 160),
      category: clean(d.category).slice(0, 80),
      ...extra,
    };
  }
  function distance(a, b, c, d) {
    const r = Math.PI / 180,
      x =
        0.5 -
        Math.cos((c - a) * r) / 2 +
        (Math.cos(a * r) * Math.cos(c * r) * (1 - Math.cos((d - b) * r))) / 2;
    return 12742 * Math.asin(Math.sqrt(x));
  }
  function distLabel(d) {
    if (!state.user || !mapped(d)) return "";
    const km = distance(
      state.user.lat,
      state.user.lng,
      d.latitude,
      d.longitude,
    );
    return km < 1
      ? `${Math.round(km * 1000)} m`
      : km < 10
        ? `${km.toFixed(1)} km`
        : `${Math.round(km)} km`;
  }
  function cityDeals() {
    return state.deals.filter(
      (d) => d.city === state.city || d.city === "australia-wide",
    );
  }
  function dealFromRoute() {
    if (!state.route.startsWith("/deals/")) return null;
    let slug;
    try { slug = decodeURIComponent(state.route.split("/")[2] || ""); } catch { return null; }
    return (
      state.deals.find(
        (d) => d.slug === slug || d.id === slug || route(d) === state.route,
      ) || null
    );
  }
  function ending(d) {
    if (!d.end) return false;
    const e = new Date(d.end),
      n = new Date(localDate(d.state));
    return !Number.isNaN(e) && e >= n && e - n <= 7 * 86400000;
  }
  const weekend=d=>availabilityMatches(d,"weekend");
  function list(kind) {
    let x = kind==="near-me"&&state.user?state.deals.filter(d=>mapped(d)&&distance(state.user.lat,state.user.lng,d.latitude,d.longitude)<=50):cityDeals();
    const verticals = {
      beauty: "beauty",
      wellness: "wellness",
      experiences: "experiences",
      activities: "activities",
      fitness: "fitness",
      drinks: "drinks",
      hair: "hair",
      golf: "golf",
      tourism: "tourism",
      stay: "stay",
      travel_stays: "travel_stays",
      freebies: "freebies",
      services: "services",
      last_minute: "last_minute",
    };
    if (verticals[kind])
      x = x.filter(
        (d) => d.vertical === verticals[kind] || d.dropType === verticals[kind],
      );
    if (kind === "food")
      x = x.filter((d) => d.vertical === "food" || isFood(d));
    if (kind === "drinks") x = x.filter((d) => d.vertical === "drinks" || isDrink(d));
    if (kind === "events")
      x = x.filter((d) => d.vertical === "events" || isEvent(d));
    if (kind === "free")
      x = x.filter(
        (d) => d.vertical === "free" || d.vertical === "freebies" || isFree(d),
      );
    if (kind === "kids")
      x = x.filter((d) => d.vertical === "family_kids" || isKids(d));
    if (kind === "shopping")
      x = x.filter((d) => d.vertical === "shopping" || isShopping(d));
    if (kind === "weekend") x = x.filter(weekend);
    if (kind === "ending-soon") x = x.filter(ending);
    if (kind === "saved")
      x = state.deals.filter((d) => state.saved.includes(d.id));
    if (kind === "near-me") {
      x = x.filter(mapped);
      if (state.user)
        x.sort(
          (a, b) =>
            distance(state.user.lat, state.user.lng, a.latitude, a.longitude) -
            distance(state.user.lat, state.user.lng, b.latitude, b.longitude),
        );
    }
    return x;
  }
  function toast(t) {
    $(".toast")?.remove();
    const n = document.createElement("div");
    n.className = "toast";
    n.setAttribute("role", "status");
    n.textContent = t;
    document.body.appendChild(n);
    setTimeout(() => n.remove(), 2200);
  }
  function go(href) {
    if (/^\/(my-perks|perk|recover|radar|standby)(\/|#|\?|$)/.test(href)) {
      location.href = href;
      return;
    }
    if (href === UNION) {
      location.href = href + location.search;
      return;
    }
    const u = new URL(href, location.origin);
    history.pushState({}, "", u.pathname + u.search);
    state.viewedDeal="";state.viewedMap="";
    state.route = u.pathname;
    state.query = u.searchParams.get("q") || "";
    destroyMap();
    scrollTo(0, 0);
    trackPage();
    render();
  }
  function brand() {
    return `<img src="/icon.svg" alt=""><span>Perk<em>Drop</em></span>`;
  }
  function nav(active) {
    const xs = [
      ["home", "⌂", "Home", "/"],
      ["food", "🍴", "Food", "/food"],
      ["map", "⌖", "Map", "/map"],
      ["free", "✦", "Free", "/free"],
      ["saved", "♡", "Saved", "/my-perks?tab=saved"],
    ];
    return `<nav class="bottom-nav">${xs.map((x) => `<a data-internal href="${x[3]}" class="${active === x[0] ? "on" : ""}"><b>${x[1]}</b>${x[2]}</a>`).join("")}</nav>`;
  }
  function footer() {
    return `<footer class="site-footer"><div class="footer-grid"><div><a class="footer-brand" data-internal href="/">${brand()}</a><p>Deals worth knowing about. Food, drinks, events, experiences and freebies — with the catch explained.</p><div class="socials"><a target="_blank" rel="noopener" href="https://www.instagram.com/perkdropofficial/">Instagram</a><a target="_blank" rel="noopener" href="https://www.tiktok.com/@perkdrop8">TikTok</a><a target="_blank" rel="noopener" href="https://www.facebook.com/perkdrop">Facebook</a></div></div><div><b>Discover</b><a data-internal href="/food">Food</a><a data-internal href="/events">Events</a><a data-internal href="/map">Map</a><a data-internal href="/about">About</a></div><div><b>Business</b><a data-internal href="/business">Create a Drop</a><a href="/claim">Claim your business</a><a href="/merchant-floor">Business sign in</a></div></div><div class="footer-legal"><a data-internal href="/terms">Terms</a> · <a data-internal href="/privacy">Privacy</a> · <a data-internal href="/merchant-terms">Merchant Terms</a> · <a data-internal href="/verification">Verification</a> · <a data-internal href="/affiliate">Affiliate Disclosure</a> · <a data-internal href="/contact">Contact</a></div></footer>`;
  }
  function locationMenu() {
    return `<div class="location-menu" id="location-overlay"><div class="location-sheet" role="dialog" aria-modal="true" aria-labelledby="location-title"><button id="close-location" class="tool-btn" aria-label="Close location chooser">Close ✕</button><h3 id="location-title">Choose your area</h3><button id="use-location" class="btn primary">⌖ Use my live location</button><div class="city-grid">${Object.entries(
      CITIES,
    )
      .map(
        ([k, v]) =>
          `<button data-city="${k}" class="${state.city === k ? "on" : ""}">${v[0]}</button>`,
      )
      .join("")}</div></div></div>`;
  }
  function shell(content, active = "home") {
    return `<div class="app-shell"><header class="topbar"><div class="topbar-inner"><a class="wordmark" data-internal href="/">${brand()}</a><button id="location-pill" class="location-pill"><i></i>${esc(CITIES[state.city]?.[0] || state.city)}⌄</button></div></header>${content}${footer()}${nav(active)}${state.locationOpen ? locationMenu() : ""}</div>`;
  }
  function searchBox(v = "") {
    return `<form role="search" id="search-form" class="searchbar"><span>⌕</span><input id="search-input" value="${esc(v)}" placeholder="Search deals, food, venues, events…" aria-label="Search PerkDrop"><button>Search</button>${v?'<button type="button" id="clear-search" aria-label="Clear search">✕</button>':''}</form>`;
  }
  function chips() {
    const options=[['/tonight','Tonight',cityDeals().filter(d=>availabilityMatches(d,'tonight')).length],['/food','Food deals',list('food').length],['/family','Family',list('kids').length],['/free','Free',list('free').length],['/weekend','This weekend',cityDeals().filter(d=>availabilityMatches(d,'weekend')).length]];
    return '<div class="quick-chips"><a data-internal href="/near-me">⌖ Near me</a>'+options.filter(x=>x[2]>=2).map(x=>'<a data-internal href="'+x[0]+'">'+x[1]+'</a>').join('')+'</div>';
  }
  function reportLink(drop,merchant) {
    return '<a class="report-link" href="/report?'+(drop?'drop='+encodeURIComponent(drop):'merchant='+encodeURIComponent(merchant))+'">Report incorrect information</a>';
  }
  function reportPage() {
    const p=new URLSearchParams(location.search),d=state.deals.find(x=>x.id===p.get('drop')),b=state.businesses.find(x=>x.id===p.get('merchant'));
    return shell('<main class="page"><section class="legal-page"><h1>Something not right?</h1><p>'+esc(d?.title||b?.name||'Report a listing')+'</p><p>A short report helps us check the facts. It goes to PerkDrop staff; it does not automatically remove a business.</p><form id="report-form" class="report-form"><label>What needs checking?<select name="reason" required><option value="">Choose a reason</option><option value="unavailable">Deal no longer available</option><option value="price">Wrong price</option><option value="times">Wrong days or times</option><option value="closed">Business closed</option><option value="location">Wrong location</option><option value="other">Other</option></select></label><label>Anything helpful? (optional)<textarea name="detail" rows="3" maxlength="1000" placeholder="What did you find? Please don’t include personal information."></textarea></label><label class="report-honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label><button class="btn primary" type="submit">Send report</button><p id="report-status" role="status"></p></form><p class="muted">No account or email needed. Reports are rate-limited using a private, hashed network identifier.</p><a data-internal href="/">Back to deals</a></section></main>');
  }
  function availabilityPage() {
    const qp=new URLSearchParams(location.search),mode=qp.get('when')||(state.route==='/today'?'today':'tonight'),all=[...new Map(cityDeals().map(d=>[d.id,d])).values()];
    const stateCode=all[0]?.state||'SA',today=localClock(stateCode)?.date,date=/^\d{4}-\d{2}-\d{2}$/.test(qp.get('date')||'')?qp.get('date'):today,time=/^(17|18|19|20):00$/.test(qp.get('time')||'')?qp.get('time'):'18:00';
    const items=all.filter(d=>mode==='selected'?selectedAvailability(d,{date,time}).eligible:availabilityMatches(d,mode));
    const options=[['tonight','Tonight'],['today','Today'],['now','Right now'],['selected','Choose date & time'],['week','Next 7 days'],['weekend','This weekend'],...['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map((d,i)=>['day-'+(i+1),d])];
    const businesses=new Set(items.map(d=>d.merchantId||d.merchant.toLowerCase())).size,now=items.filter(d=>availabilityMatches(d,'now')),later=items.filter(d=>!availabilityMatches(d,'now'));
    const groups=mode==='tonight'?'<h2>Available now ('+now.length+')</h2><div class="grid">'+now.map(card).join('')+'</div><h2>Later tonight ('+later.length+')</h2><div class="grid">'+later.map(card).join('')+'</div>':'<div class="grid">'+items.map(card).join('')+'</div>';
    return shell('<main class="page"><section class="section"><div class="eyebrow">'+esc(CITIES[state.city]?.[0]||state.city)+'</div><h1>Make a plan</h1><p>Checked offer service times in the venue’s local time. Future results follow the currently recorded schedule, not a guarantee of availability. Booking, weather and listed conditions still apply.</p><label class="availability-filter">When? <select id="availability-filter">'+options.map(x=>'<option value="'+x[0]+'" '+(x[0]===mode?'selected':'')+'>'+x[1]+'</option>').join('')+'</select></label>'+(mode==='selected'?'<form id="selected-time-form" class="selected-time"><label>Date <input id="selected-date" type="date" required value="'+esc(date)+'"></label><label>Time <select id="selected-time">'+['17:00','18:00','19:00','20:00'].map(t=>'<option '+(t===time?'selected':'')+'>'+t+'</option>').join('')+'</select></label><button class="btn secondary">Check this time</button></form>':'')+'<p role="status">'+businesses+' distinct businesses · '+items.length+' offers · '+all.filter(d=>!d.availability?.windows?.length).length+' other listings have unconfirmed times.</p>'+groups+(!items.length?'<div class="empty"><h2>No confirmed options for this time</h2><p>We won’t guess service hours. Try another day, or browse food deals and check directly with the venue.</p><a class="btn secondary" data-internal href="/food">Browse food deals</a></div>':'')+'</section></main>');
  }
  function photoCredit(d){const p=d.imageCredit;if(!p||image(d)===PLACEHOLDER)return '';const link=(url,label)=>/^https:\/\//.test(url||'')?'<a target="_blank" rel="noopener noreferrer" href="'+esc(url)+'">'+esc(label)+'</a>':esc(label);return '<div class="photo-credit">'+esc(p.caption||'')+' '+link(p.source,'Photo source')+(p.licenseUrl?' · '+link(p.licenseUrl,p.license||'Licence'):'')+'</div>';}
  function card(d) {
    const t = type(d),
      dist = distLabel(d);
    return `<article class="deal-card ${d.imageFit==='contain'?'poster-card':''}"><a class="card-link" data-internal href="${esc(route(d))}"><div class="card-image"><img loading="lazy" src="${esc(image(d))}" alt="${esc(image(d)===PLACEHOLDER?"Photo unavailable":d.imageUrl?.includes("perkdrop-union-slideshow")?"Food at Union Hotel, Adelaide":d.imageAlt||d.title)}"><div class="shade"></div><span class="badge">${esc(badge(d))}</span><span class="type-pill type-${t[0]}">${t[1]} ${t[2]}</span></div><div class="card-body"><div class="merchant-line"><span>${esc(d.merchant)}</span><span class="distance">${esc(dist)}</span></div>${mBadge(d)}<h3>${esc(d.title)}</h3><div class="meta">${esc(scheduleLabel(d))}</div><div class="meta freshness">${esc(freshness(d).label)}</div><div class="card-condition">${esc(d.conditions || "Check conditions with the venue")}</div>${d.capacityRemaining != null ? `<div class="spots ${Number(d.capacityRemaining) <= 5 ? "urgent" : ""}">${Number(d.capacityRemaining) <= 0 ? "SOLD OUT" : `${esc(d.capacityRemaining)} ${unitLabel(d)} LEFT`}</div>` : ""}</div></a>${photoCredit(d)}<button class="save" aria-label="Save ${esc(d.title)}" data-save="${esc(d.id)}">${state.saved.includes(d.id) ? "♥" : "♡"}</button></article>`;
  }
  function listPage(k, title, eye = "PERKDROP") {
    const xs = list(k),
      active = ["food", "free", "saved"].includes(k) ? k : "home";
    return shell(
      `<main class="page">${searchBox()}${chips()}<section class="section"><div class="section-head"><div><div class="eyebrow">${eye}</div><h2>${esc(title)}</h2></div><span>${xs.length}</span></div>${k === "near-me" && !state.user ? `<div class="empty"><p>Use your location to sort Drops by distance.</p><button id="near-location" class="btn primary">⌖ Use my location</button></div>` : ""}<div class="grid compact">${xs.map(card).join("")}</div>${!xs.length ? '<div class="empty">No matching Drops right now.</div>' : ""}</section></main>`,
      active,
    );
  }
  function searchPage() {
    const xs = (state.query?state.deals:cityDeals()).filter(d => searchMatches(text(d) + " " + d.city + " " + d.state, state.query));
    const businesses=state.query?state.businesses.filter(b=>searchMatches([b.name,b.market,b.state,b.location,b.category,b.cuisine].join(" "),state.query)):[];
    return shell(
      `<main class="page">${searchBox(state.query)}${chips()}<section class="section"><div class="section-head"><div><div class="eyebrow">SEARCH</div><h2>${state.query ? `Results across Australia for “${esc(state.query)}”` : "Search PerkDrop"}</h2></div><span>${xs.length}</span></div><div class="grid compact">${xs.map(card).join("")}</div>${!xs.length ? '<div class="empty">No offers matched. Try another food, venue or suburb. Business listings are shown below when available.</div>' : ""}${businesses.length?'<h2>Businesses</h2><div class="grid">'+businesses.slice(0,100).map(b=>venueCard({...b,merchant:b.name})).join('')+'</div>':''}${state.directoryLoading?'<p role="status">Searching business listings…</p>':''}</section></main>`,
    );
  }
  function claimUrl(d) {
    try {
      const u = new URL(d.claimUrl || "/claim", location.origin),
        m = u.searchParams.get("merchant");
      return m ? `/claim?merchant=${encodeURIComponent(m)}` : "/claim";
    } catch {
      return "/claim";
    }
  }
  function trust(d) {
    if(d.offerVerification==='business_approved')return '<div class="trust verified"><b>Business-approved offer</b><span>The business approved these offer terms. This is separate from claiming its directory profile.</span></div>';
    const s = mState(d);
    if (s === "exclusive")
      return `<div class="trust exclusive"><b>🔥 PerkDrop Exclusive</b><span>This business currently has an exclusive PerkDrop offer.</span></div>`;
    if (s === "partner")
      return `<div class="trust partner"><b>💜 PerkDrop Partner</b><span>This business has an active relationship with PerkDrop.</span></div>`;
    if (s === "verified")
      return `<div class="trust verified"><b>✓ Verified business</b><span>The business-profile controller has been verified as authorised to act for this business.</span></div>`;
    return `<div class="trust"><b>Public-source offer</b><span>Checked against a public source, not verified by the business.</span>${d.claimable !== false ? `<a class="claim-link" href="${esc(claimUrl(d))}">Claim this venue →</a>` : ""}</div>`;
  }
  function capLabel(d) {
    if (d.capacityRemaining == null) return "CHECK AVAILABILITY";
    const n = Number(d.capacityRemaining);
    return n <= 0 ? "SOLD OUT" : `${n} ${unitLabel(d)} LEFT`;
  }
  function capacity(d) {
    if (
      d.actionType === "booking_claim" ||
      d.fulfilmentMode === "booking_claim"
    )
      return (
        '<section class="capacity"><p>Booking confirmation is required before a pass is issued.</p><a class="btn primary" href="' +
        esc(d.merchantBookingUrl || d.goUrl || d.source) +
        '" target="_blank" rel="noopener">Book with the venue</a></section>'
      );
    if (!["direct_claim", "merchant_confirmation"].includes(d.fulfilmentMode))
      return (
        '<section class="capacity"><p>This offer is booked externally. Opening the provider does not confirm your booking or create a PerkDrop pass.</p><a class="btn primary" href="' +
        esc(d.merchantBookingUrl || d.goUrl || d.source) +
        '" target="_blank" rel="noopener">Check provider availability</a></section>'
      );
    const closed =
        d.capacityRemaining == null || Number(d.capacityRemaining) <= 0,
      max = Math.min(20, Math.max(1, Number(d.capacityRemaining) || 1));
    state.party = Math.min(state.party, max);
    return (
      '<section class="capacity"><div class="eyebrow">' +
      esc(capLabel(d)) +
      "</div><label>Quantity (" +
      esc(unitLabel(d)) +
      ')<select id="claim-quantity">' +
      Array.from(
        { length: max },
        (_, i) =>
          '<option value="' +
          (i + 1) +
          '" ' +
          (state.party === i + 1 ? "selected" : "") +
          ">" +
          (i + 1) +
          "</option>",
      ).join("") +
      "</select></label><p>" +
      (d.fulfilmentMode === "merchant_confirmation"
        ? "The merchant must confirm your request within 15 minutes."
        : "The server reserves your quantity and issues a pass.") +
      '</p><button id="claim-drop" class="btn primary" ' +
      (closed ? "disabled" : "") +
      ">" +
      (closed
        ? "Unavailable"
        : d.fulfilmentMode === "merchant_confirmation"
          ? "Request confirmation"
          : "Claim this Drop") +
      "</button></section>"
    );
  }
  function detail(d) {
    const t = type(d),
      saved = state.saved.includes(d.id),
      cap = Boolean(d.redemptionAvailable);
    document.title = `${d.title} | PerkDrop`;
    return `<div class="app-shell"><main class="detail"><section class="detail-hero ${d.imageFit==='contain'?'poster-hero':''}"><button id="back-btn" class="back" aria-label="Go back">←</button><img src="${esc(image(d))}" alt="${esc(image(d)===PLACEHOLDER?"Photo unavailable":d.imageAlt||d.title)}"><div class="detail-title"><span class="badge static">${esc(badge(d))}</span><span class="detail-type type-${t[0]}">${t[1]} ${t[2]}</span><h1>${esc(d.title)}</h1><div>${esc(d.merchant)}</div></div></section><div class="detail-body">${photoCredit(d)}<div class="detail-tools"><button class="tool-btn" data-save="${esc(d.id)}">${saved ? "♥ Saved" : "♡ Save"}</button><button id="share-drop" class="tool-btn">↗ Share</button></div><div class="facts">📍 ${esc(d.location || "Check venue location")}<br>◷ ${esc(d.timing || "Check availability")}<br>${esc(freshness(d).label)}</div>${d.merchantSlug?'<p><a data-internal href="/venues/'+encodeURIComponent(d.merchantSlug)+'">View '+esc(d.merchant)+' business profile →</a></p>':''}${reportLink(d.id,d.merchantId)}${d.availability?.notes?`<p class="availability-note">${esc(d.availability.notes)}</p>`:""}${cap ? capacity(d) : trust(d)}<p>${esc(d.description)}</p><div class="catch"><b>THE CATCH</b><br>${esc(d.conditions || "Check the official source before travelling, booking or paying.")}</div>${mapped(d) ? '<div id="detail-map" class="detail-map"></div>' : ""}${cap ? "" : `<div class="detail-cta"><a id="official-cta" class="btn primary" target="_blank" rel="noopener" href="${esc(d.goUrl || d.source || d.officialSource)}">View official deal →</a><a id="nav-cta" class="btn secondary" target="_blank" rel="noopener" href="${esc(navUrl(d))}">⌖ Navigate</a></div>`}</div></main>${footer()}${nav(isFood(d) ? "food" : isFree(d) ? "free" : "home")}</div>`;
  }
  const legal = {
    terms: [
      "Terms of Use",
      "PerkDrop helps people discover offers, events and venue information. Venues and organisers supply the underlying goods and services. Offers, capacity, prices and conditions can change. A capacity Drop reserves the selected spots only and is not a table booking unless expressly stated. Codes may not be copied, resold or misused. Australian Consumer Law rights are not excluded.",
    ],
    privacy: [
      "Privacy Policy",
      "PerkDrop may process session identifiers, analytics, referral and UTM data, saved preferences, location only after permission, redemption details and business account information. Supabase and Vercel provide infrastructure. Contact perkdropofficial@gmail.com for access, correction or privacy enquiries.",
    ],
    "merchant-terms": [
      "Merchant Terms",
      "Authorised business representatives must provide truthful offers and genuine discounts, keep account access secure and hold rights to supplied media. Merchants remain responsible for lawful service and honouring valid Drops subject to the disclosed conditions. Fees apply only where separately agreed.",
    ],
    "drop-terms": [
      "Drop Terms",
      "Check the venue, time, conditions and selected party size before claiming. A Drop reservation is not a table booking unless expressly stated. Show valid codes as directed by the venue.",
    ],
    verification: [
      "Verification",
      "✓ OFFER CHECKED means PerkDrop checked the offer or source information at the time shown. ✓ VERIFIED BUSINESS means the profile controller was verified as authorised to act for the business. Neither is an endorsement or guarantee.",
    ],
    affiliate: [
      "Affiliate Disclosure",
      "Some links, offers or placements may be affiliate, sponsored or commercially supported. Where PerkDrop may receive a fee or commission we aim to disclose this clearly.",
    ],
    contact: [
      "Contact PerkDrop",
      "Deals, corrections, business, media and privacy enquiries: perkdropofficial@gmail.com.",
    ],
    about: [
      "About PerkDrop",
      "PerkDrop is an Australian deals discovery platform built to surface offers worth knowing about and help local businesses fill real capacity. We focus on clear conditions, live capacity where available and measurable customer delivery rather than vague promotion.",
    ],
  };
  function legalPage(k) {
    const x = legal[k] || legal.terms;
    return shell(
      `<main class="page"><article class="legal-page"><div class="eyebrow">PERKDROP</div><h1>${x[0]}</h1><p>${x[1]}</p>${k === "about" ? "<p>For businesses, PerkDrop supports verified profiles, limited-capacity Drops, booking flows, redemption tracking and transparent performance reporting.</p>" : ""}</article></main>`,
    );
  }
  function popup(d) {
    const t = type(d);
    return `<div class="popup ${d.imageFit==='contain'?'poster-popup':''}"><img loading="lazy" src="${esc(image(d))}" alt="${image(d)===PLACEHOLDER?'Photo unavailable':esc(d.imageAlt||d.title)}"><span class="type-${t[0]}">${t[1]} ${t[2]}</span><h3>${esc(d.title)}</h3><b>${esc(d.merchant)}</b>${photoCredit(d)}<p>${esc(d.timing || "")}</p><a data-internal href="${esc(route(d))}">View Drop</a> · <a target="_blank" href="${esc(navUrl(d))}">Navigate</a></div>`;
  }
  function pin(d) {
    const t = d.business ? ["business","•","Business"] : type(d);
    return L.divIcon({
      className: "",
      html: `<div class="map-pin pin-${t[0]}">${t[1]}</div>`,
      iconSize: [38, 38],
      iconAnchor: [19, 36],
    });
  }
  function mapEntries() {
    const near=d=>!state.user||(mapped(d)&&distance(state.user.lat,state.user.lng,d.latitude,d.longitude)<=50);
    const deals = (state.user?state.deals.filter(near):cityDeals()).filter(d => searchMatches(text(d), state.query));
    const venues = state.businesses.filter(b => (state.user?near(b):b.market === state.city) && searchMatches([b.name,b.location,b.category,b.cuisine,b.venueType].join(' '),state.query));
    const entries = new Map();
    for (const d of deals) {
      const key = d.merchantId + ':' + d.latitude + ':' + d.longitude;
      if (!entries.has(key)) entries.set(key,{...d,offers:[]});
      entries.get(key).offers.push(d);
    }
    for (const b of venues) {
      if (deals.some(d => d.merchantId===b.id && mapped(d))) continue;
      entries.set('business:'+b.id,{id:b.id,merchantId:b.id,merchant:b.name,title:b.name,slug:b.slug,city:b.market,location:b.location,category:b.category,latitude:b.latitude,longitude:b.longitude,imageUrl:b.image,publicState:b.publicState,publicLabel:b.publicLabel,claimable:b.claimable,claimUrl:b.claimUrl,website:b.website,business:true,offers:[]});
    }
    return [...entries.values()].filter(d => state.mapFilter !== 'offers' || d.offers.length);
  }
  function venueCard(d) {
    return '<article class="venue-card">'+(d.image?'<img class="venue-thumb" loading="lazy" src="'+esc(safeImage(d.image))+'" alt="'+esc(d.name||d.merchant)+'">':'')+'<h3>'+esc(d.merchant)+'</h3><p>'+esc(d.location)+'</p><p class="muted">Business listing · No active offer listed</p><a class="btn secondary" data-internal href="/venues/'+encodeURIComponent(d.slug)+'">View business</a></article>';
  }
  function mapPage() {
    const xs = mapEntries(), pins=xs.filter(mapped), missing=xs.length-pins.length;
    return shell('<main class="page map-page">'+searchBox(state.query)+'<section class="section"><div class="section-head"><div><div class="eyebrow">EXPLORE YOUR AREA</div><h1>Explore the map</h1></div><span>'+pins.length+' mapped</span></div><div class="map-toolbar"><button id="map-location" class="btn primary">⌖ Use my location</button><label>Show <select id="map-filter"><option value="all" '+(state.mapFilter==='all'?'selected':'')+'>Deals & businesses</option><option value="offers" '+(state.mapFilter==='offers'?'selected':'')+'>Active offers only</option></select></label></div><p class="muted map-legend">Colour pins: offers. Grey: businesses. '+(state.directoryLoading?'Loading businesses… ':'')+''+(missing?missing+' listings have no confirmed pin.':'')+'</p>'+(state.directoryError?'<p role="status">Business listings could not load. Active offers are still shown. Refresh to try again.</p>':'')+'<div class="mapbox"><div id="perk-map" aria-label="Map of deals and businesses"><p role="status">Loading map…</p></div></div><div class="grid compact map-list">'+xs.map(d=>d.business?venueCard(d):d.offers.map(card).join('')).join('')+'</div>'+(!xs.length?'<div class="empty">No matches in this area. Clear your search or choose another city.</div>':'')+'</section></main>','map');
  }
  function venuePage(b) {
    const offers=state.deals.filter(d=>d.merchantId===b.id);
    return shell('<main class="page"><section class="section"><div class="eyebrow">BUSINESS LISTING</div><h1>'+esc(b.name)+'</h1><p>'+esc(b.location)+'</p><p>'+esc(b.publicState==='unclaimed'?'Public listing · not yet business-verified':b.publicLabel)+'</p><p>'+esc(String(b.category||'').replaceAll('_',' '))+'</p>'+(b.image?'<img class="venue-photo" src="'+esc(safeImage(b.image))+'" alt="'+esc(b.name)+'">':'<p class="muted">A verified venue photo is not available yet.</p>')+reportLink(null,b.id)+(b.photoCaption?'<p class="muted">'+esc(b.photoCaption)+(b.photoSource&&/^https:\/\//.test(b.photoSource)?' · <a href="'+esc(b.photoSource)+'" target="_blank" rel="noopener">Photo source / licence</a>':'')+'</p>':'')+'<div class="hero-actions">'+(b.website?'<a class="btn primary" target="_blank" rel="noopener" href="'+esc(b.website)+'">Official website</a>':'')+'<a class="btn secondary" target="_blank" rel="noopener" href="'+esc(navUrl({...b,merchant:b.name}))+'">Directions</a>'+(b.claimable?'<a class="btn secondary" href="/claim?merchant='+encodeURIComponent(b.slug)+'">Claim this business</a>':'')+'</div><h2>Current offers</h2><div class="grid">'+offers.map(card).join('')+'</div>'+(!offers.length?'<p>No active offer is listed. Check the official website for current information.</p>':'')+'</section></main>');
  }
  let leafletReady;
  function ensureLeaflet() {
    if (typeof L !== 'undefined') return Promise.resolve();
    if (!leafletReady) leafletReady=new Promise((resolve,reject)=>{
      const css=document.createElement('link');css.rel='stylesheet';css.href='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css';document.head.append(css);
      const js=document.createElement('script');js.src='https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js';js.onload=resolve;js.onerror=reject;document.head.append(js);
    });
    return leafletReady;
  }
  function destroyMap() {
    if (state.detailMap) { state.detailMap.stop(); state.detailMap.remove(); state.detailMap=null; }
    if (state.map) {
      try {
        state.map.stop();
        state.map.remove();
      } catch {}
      state.map = null;
    }
  }
  async function initMap() {
    destroyMap();
    const node = $("#perk-map");
    if (!node) return;
    try { await ensureLeaflet(); } catch { node.innerHTML="<p>Map unavailable. Use the listings and Directions links below.</p>"; return; }
    if (!node.isConnected) return;
    node.textContent="";
    const c = CITIES[state.city] || CITIES.adelaide,
      m = L.map(node,{zoomAnimation:false,fadeAnimation:false}).setView([c[2], c[3]], 12);
    state.map = m;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(m);
    const f = L.featureGroup().addTo(m);
    const groups=new Map();
    for(const d of mapEntries().filter(mapped)) {
      const key=d.latitude+':'+d.longitude;
      if(!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(d);
    }
    for(const group of groups.values()) {
      const d=group[0], count=group.length;
      L.marker([d.latitude,d.longitude],{icon:count>1?L.divIcon({className:'',html:'<div class="map-pin">'+count+'</div>',iconSize:[38,38]}):pin(d),title:d.merchant})
        .addTo(f).bindPopup(group.map(x=>x.business?'<div class="popup"><h3>'+esc(x.merchant)+'</h3><p>'+esc(x.location)+'</p><p>Business listing · No active offer</p><a data-internal href="/venues/'+encodeURIComponent(x.slug)+'">View business</a> · <a target="_blank" rel="noopener" href="'+esc(navUrl(x))+'">Directions</a></div>':x.offers.map(popup).join('')).join(''),{maxWidth:310})
        .on('popupopen',()=>track('map_marker_open',{merchant_id:d.merchantId,deal_id:d.business?null:d.id,listing_type:d.business?'business':'offer'}));
    }
    if (state.user)
      L.circleMarker([state.user.lat, state.user.lng], {
        radius: 8,
        weight: 3,
        fillOpacity: 1,
      })
        .addTo(m)
        .bindTooltip("You are here");
    if (f.getLayers().length > 0)
      m.fitBounds(f.getBounds().pad(0.12), { maxZoom: 15, animate:false });
    if(state.viewedMap!==state.pageKey){track("map_open", {});state.viewedMap=state.pageKey;}
  }
  async function initDetailMap(d) {
    const node = $("#detail-map");
    if (!node || !mapped(d)) return;
    try { await ensureLeaflet(); } catch { node.innerHTML="<p>Map unavailable. Use Directions below.</p>"; return; }
    if(!node.isConnected || node._leaflet_id) return;
    const m = L.map(node, { scrollWheelZoom: false,zoomAnimation:false,fadeAnimation:false }).setView(
      [d.latitude, d.longitude],
      15,
    );
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap",
    }).addTo(m);
    state.detailMap=m;
    L.marker([d.latitude, d.longitude], { icon: pin(d) })
      .addTo(m)
      .bindPopup(popup(d))
      .openPopup();
  }
  function requestLocation() {
    if (!navigator.geolocation) return toast("Location is not available.");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        if(!validCoordinates(p.coords.latitude,p.coords.longitude)){state.locationOpen=true;render();toast("PerkDrop covers Australia. Choose an Australian city.");return;}
        state.user = { lat: p.coords.latitude, lng: p.coords.longitude };
        let best = state.city,
          bd = Infinity;
        for (const [k, v] of Object.entries(CITIES)) {
          const d = distance(state.user.lat,state.user.lng,v[2],v[3]);
          if (d < bd) {
            bd = d;
            best = k;
          }
        }
        state.city = best;
        store.set("perkdrop_city", best);
        state.locationOpen = false;
        render();
        toast(`Using your location near ${CITIES[best][0]}`);
      },
      () => { state.locationOpen=true; render(); toast("Location unavailable. Choose a city to continue."); },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  }
  async function claim(d) {
    const btn = $("#claim-drop");
    if (btn) btn.disabled = true;
    try {
      const { marketplace } = await import("/marketplace-client.js");
      const j = await marketplace("claim", {
        offer_id: d.merchantOfferId,
        quantity: state.party,
      });
      location.href = "/perk#" + j.redemption.pass_reference;
    } catch (e) {
      toast(e.message);
      if (btn) btn.disabled = false;
    }
  }
  async function submitMerchant(e) {
    e.preventDefault();
    const f = e.currentTarget,
      s = $("#merchant-status"),
      b = f.querySelector(".submit-btn"),
      fd = new FormData(f),
      body = Object.fromEntries(fd.entries());
    body.authority_confirmed = f.elements.authority_confirmed.checked;
    body.accuracy_confirmed = f.elements.accuracy_confirmed.checked;
    body.city = CITIES[state.city]?.[0] || "Adelaide";
    body.state = CITIES[state.city]?.[1] || "";
    b.disabled = true;
    s.textContent = "Submitting…";
    track("business_submit_started", {});
    try {
      const r = await fetch(SUBMIT, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }),
        j = await r.json();
      if (!r.ok) throw Error(j.error || "Submission failed");
      f.reset();
      s.textContent = "Submitted. PerkDrop will review it before publication.";
      s.className = "form-status success";
      track("business_submit_completed", {});
    } catch (x) {
      s.textContent = String(x.message).replaceAll("_", " ");
      s.className = "form-status error";
    } finally {
      b.disabled = false;
    }
  }
  function bind() {
    $('#availability-filter')?.addEventListener('change',e=>go('/tonight?when='+encodeURIComponent(e.target.value)));
    $('#selected-time-form')?.addEventListener('submit',e=>{e.preventDefault();go('/tonight?when=selected&date='+encodeURIComponent($('#selected-date').value)+'&time='+encodeURIComponent($('#selected-time').value))});
    $('#report-form')?.addEventListener('submit',async e=>{
      e.preventDefault();const f=e.currentTarget,button=f.querySelector('button'),status=$('#report-status'),p=new URLSearchParams(location.search),body=Object.fromEntries(new FormData(f));
      body.drop=p.get('drop');body.merchant=p.get('merchant');button.disabled=true;status.textContent='Sending…';
      try{const r=await fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-listing-reports',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)}),j=await r.json();if(!r.ok||!j.ok)throw Error(j.error||'Please try again.');status.textContent='Thank you. Your report is saved for PerkDrop review. Nothing has been removed automatically.';f.querySelector('textarea').value='';}
      catch(err){status.textContent=err.message||'Could not send. Please try again.';}finally{button.disabled=false;}
    });
    $("#clear-search")?.addEventListener("click",()=>go(state.route==="/map"?"/map":"/search"));
    $("#map-filter")?.addEventListener("change",e=>{state.mapFilter=e.target.value;render();});
    $("#close-location")?.addEventListener("click",()=>{state.locationOpen=false;render();$("#location-pill")?.focus();});
    if(state.locationOpen) $("#close-location")?.focus();
    $("#claim-quantity")?.addEventListener("change", (e) => {
      state.party = Number(e.target.value);
    });
    $("#location-pill")?.addEventListener("click", () => {
      state.locationOpen = true;
      render();
    });
    $("#location-overlay")?.addEventListener("click", (e) => {
      if (e.target.id === "location-overlay") {
        state.locationOpen = false;
        render();
      }
    });
    $$("[data-city]").forEach(
      (b) =>
        (b.onclick = () => {
          state.city = b.dataset.city;
          state.user = null;
          store.set("perkdrop_city", state.city);
          state.locationOpen = false;
          render();
        }),
    );
    $("#use-location")?.addEventListener("click", requestLocation);
    $("#near-location")?.addEventListener("click", requestLocation);
    $("#map-location")?.addEventListener("click", requestLocation);
    $("#back-btn")?.addEventListener("click", () =>
      history.length > 1 ? history.back() : go("/"),
    );
    $("#search-form")?.addEventListener("submit", (e) => {
      e.preventDefault();
      const q = clean($("#search-input")?.value);
      if(/^near\s+me$/i.test(q)){go('/near-me');return;}
      if (q) track("search", { search_term: q.slice(0, 80) });
      go(`${state.route==="/map"?"/map":"/search"}?q=${encodeURIComponent(q)}`);
    });
    $("#merchant-form")?.addEventListener("submit", submitMerchant);
    const d = dealFromRoute();
    $("#share-drop")?.addEventListener("click", async () => {
      if (!d) return;
      const u = location.origin + route(d);
      track("share",props(d));
      try {
        if (navigator.share)
          await navigator.share({
            title: d.title,
            text: `${d.title} — ${d.merchant}`,
            url: u,
          });
        else {
          await navigator.clipboard.writeText(u);
          toast("PerkDrop link copied");
        }
      } catch {}
    });
    $("#claim-drop")?.addEventListener("click", () => d && claim(d));
    $("#official-cta")?.addEventListener(
      "click",
      () => d && track("official_deal_click", props(d)),
    );
    $("#nav-cta")?.addEventListener(
      "click",
      () => d && track("directions_click", props(d)),
    );
    $$(".claim-link").forEach((a) =>
      a.addEventListener(
        "click",
        () => d && track("claim_portal_open", props(d)),
      ),
    );
  }
  document.addEventListener("error",e=>{const img=e.target;if(img.tagName==="IMG" && !img.src.endsWith(PLACEHOLDER)){img.src=PLACEHOLDER;img.alt="Photo unavailable";}},true);
  document.addEventListener("keydown",e=>{
    if(!state.locationOpen)return;
    if(e.key==="Escape"){state.locationOpen=false;render();$("#location-pill")?.focus();}
    if(e.key==="Tab"){
      const controls=[...document.querySelectorAll('[role="dialog"] button,[role="dialog"] input,[role="dialog"] select,[role="dialog"] a[href]')].filter(x=>!x.disabled&&x.getBoundingClientRect().width>0);
      const first=controls[0],last=controls.at(-1);
      if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}
      else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}
    }
  });
  document.addEventListener("click", async (e) => {
    const p = e.target.closest("[data-party]");
    if (p) {
      state.party = Number(p.dataset.party) || 1;
      render();
      return;
    }
    const s = e.target.closest("[data-save]");
    if (s) {
      e.preventDefault();
      e.stopPropagation();
      const id = s.dataset.save;
      try {
        const { marketplace } = await import("/marketplace-client.js");
        await marketplace("save", {
          kind: "drop",
          target: id,
          remove: state.saved.includes(id),
        });
      } catch (error) {
        toast(error.message);
        return;
      }
      state.saved = state.saved.includes(id)
        ? state.saved.filter((x) => x !== id)
        : [...state.saved, id];
      store.set("perkdrop_saved", JSON.stringify(state.saved));
      const d = state.deals.find((x) => x.id === id);
      if (d)
        track(
          "save_toggle",
          props(d, { saved_state: state.saved.includes(id) }),
        );
      render();
      return;
    }
    const a = e.target.closest("a[data-internal]");
    if (a && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      go(a.getAttribute("href"));
    }
  });
  function render() {
    destroyMap();
    const app = $("#app");
    if (state.loading) {
      app.innerHTML =
        '<main class="boot"><img src="/icon.svg" alt="" class="boot-icon"><div class="boot-logo">Perk<span>Drop</span></div><p role="status">Loading nearby Drops…</p></main>';
      return;
    }
    if (state.error) {
      app.innerHTML = `<main class="boot"><h1>Could not load deals</h1><p>${esc(state.error)}</p><button class="btn primary" onclick="location.reload()">Try again</button></main>`;
      return;
    }
    if ((state.route==='/map'||state.route==='/search'||state.route.startsWith('/venues/'))&&!state.directoryLoaded&&!state.directoryLoading&&!state.directoryError) loadDirectory();
    const d = dealFromRoute();
    if (d) app.innerHTML = detail(d);
    else if (state.route.startsWith("/deals/"))
      app.innerHTML = shell(
        `<main class="page"><section class="empty"><h1>${app.dataset.expiredDeal==='true'?'This offer has ended':'Offer not found'}</h1><p>This link does not have an available offer. Explore current deals below.</p><a class="btn primary" data-internal href="/food">Explore current Drops</a></section></main>`,
      );
    else if (state.route.startsWith("/venues/")) {
      const b=state.businesses.find(b=>"/venues/"+b.slug===state.route);
      if(b&&state.lastBusinessPage!==location.pathname+location.search){state.lastBusinessPage=location.pathname+location.search;track("business_open",{merchant_id:b.id,slug:b.slug});}
      app.innerHTML=b?venuePage(b):shell('<main class="page"><h1>'+(state.directoryLoading?'Loading business…':state.directoryError?'Business details are temporarily unavailable':'Business not found')+'</h1><a href="/map">Explore the map</a></main>');
    }
    else if (state.route === "/") app.innerHTML = home();
    else if (state.route === "/map") app.innerHTML = mapPage();
    else if (state.route === "/business") app.innerHTML = business();
    else if (state.route === "/search") app.innerHTML = searchPage();
    else if (state.route === "/food")
      app.innerHTML = listPage("food", "Food deals", "EAT & DRINK FOR LESS");
    else if (state.route === "/drinks")
      app.innerHTML = listPage("drinks", "Drink specials", "DRINKS");
    else if (state.route === "/events")
      app.innerHTML = listPage(
        "events",
        "Events worth knowing about",
        "WHAT’S ON",
      );
    else if (state.route === "/free")
      app.innerHTML = listPage("free", "Free stuff", "ZERO DOLLARS");
    else if (state.route === "/kids")
      app.innerHTML = listPage("kids", "Kids & family", "FAMILY");
    else if (state.route === "/shopping")
      app.innerHTML = listPage("shopping", "Shopping deals", "SHOP");
    else if (state.route === "/weekend")
      app.innerHTML = listPage("weekend", "This weekend", "MAKE A PLAN");
    else if (state.route === "/ending-soon")
      app.innerHTML = listPage("ending-soon", "Ending soon", "DON’T MISS IT");
    else if (state.route === "/near-me")
      app.innerHTML = listPage("near-me", "Near me", "CLOSE BY");
    else if (state.route === "/saved")
      app.innerHTML = listPage("saved", "Saved Drops", "YOUR LIST");
    else if (
      [
        "/terms",
        "/privacy",
        "/merchant-terms",
        "/drop-terms",
        "/verification",
        "/affiliate",
        "/contact",
        "/about",
      ].includes(state.route)
    )
      app.innerHTML = legalPage(state.route.slice(1));
    else
      app.innerHTML = shell(
        '<main class="page"><div class="empty">That page could not be found.</div></main>',
      );
    bind();
    requestAnimationFrame(() => {
      if (state.route === "/map") initMap();
      const cur = dealFromRoute();
      if (cur) {
        if(state.viewedDeal!==state.pageKey){track("deal_open",props(cur));state.viewedDeal=state.pageKey;}
        initDetailMap(cur);
      }
    });
  }
  async function loadCatalogue() {
    let r, lastError;
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        r = await fetch(API, {
          headers: { accept: "application/json" },
          cache: "no-store",
          signal: AbortSignal.timeout(12000),
        });
        if (r.ok || ![408, 429, 500, 502, 503, 504].includes(r.status) || attempt === 1) break;
        await r.arrayBuffer().catch(() => {});
      } catch (error) {
        lastError = error;
        if (attempt === 1) throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
    if (!r) throw lastError || Error("Catalogue unavailable");
    if (!r.ok) throw Error(`API ${r.status}`);
    const j = await r.json();
    state.deals = norm(Array.isArray(j) ? j : j.deals || []).map(enrich);
  }
  async function load() {
    try {
      await loadCatalogue();
      state.loading = false;
      trackPage();
      render();
    } catch (e) {
      console.error(e);
      state.loading = false;
      state.error =
        "PerkDrop could not load the live catalogue. Check your connection and try again.";
      render();
    }
  }
  async function loadDirectory() {
    state.directoryLoading=true;
    try {
      const r=await fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-business-directory?limit=1000',{signal:AbortSignal.timeout(12000)});
      if(!r.ok)throw Error('directory');
      const j=await r.json();state.businesses=j.businesses||[];state.directoryLoaded=true;
    } catch { state.directoryError='unavailable'; }
    finally { state.directoryLoading=false;render(); }
  }
  window.addEventListener("popstate", () => {
    state.viewedDeal="";state.viewedMap="";
    state.route = location.pathname;
    state.query = new URLSearchParams(location.search).get("q") || "";
    destroyMap();
    trackPage();
    render();
  });
  if ("serviceWorker" in navigator)
    window.addEventListener("load", () =>
      navigator.serviceWorker
        .register(`/sw.js?v=${VERSION}`)
        .then((r) => r.update())
        .catch(() => {}),
    );
  function home() {
    const all=cityDeals().filter(d=>['A','B'].includes(d.qualityGrade)&&freshness(d).state==='recent'),tonight=all.filter(d=>availabilityMatches(d,'tonight')),food=all.filter(isFood),free=all.filter(isFree);
    const section=(title,xs,href)=>xs.length?'<section class="section"><div class="section-head"><h2>'+title+'</h2><a data-internal href="'+href+'">See all</a></div><div class="grid">'+xs.slice(0,6).map(card).join('')+'</div></section>':'';
    return shell('<main class="page"><section class="hero"><div class="eyebrow">'+esc(CITIES[state.city]?.[0]||state.city)+' · LOCAL OFFERS</div><h1>Find something<br><strong>worth going out for.</strong></h1><p>Food specials, free places and clear conditions. Choose your area, then make a plan.</p>'+searchBox()+chips()+'</section>'+(tonight.length?section('Use it tonight',tonight,'/tonight'):'<p class="availability-note">No confirmed tonight options in this area. <a data-internal href="/tonight">Check another day</a> or browse the offers below.</p>')+section('Food worth a look',food,'/food')+section('Free things to do',free,'/free')+(!food.length&&!free.length?section('Around your area',all,'/search'):'')+'</main>');
  }
  const MARKET_PAGES = {
    beauty: ["beauty", "Beauty & wellness", "APPOINTMENTS & SELF-CARE"],
    hair: ["hair", "Hair appointments", "HAIR & GROOMING"],
    wellness: ["wellness", "Beauty & wellness", "APPOINTMENTS & SELF-CARE"],
    experiences: ["experiences", "Experiences", "THINGS TO DO"],
    activities: ["activities", "Activities", "PLACES TO GO"],
    fitness: ["fitness", "Health & fitness", "MOVE, RECOVER & TRAIN"],
    golf: ["golf", "Golf", "TEE TIMES & PLAYER PLACES"],
    tourism: ["tourism", "Tourism", "TOURS & ATTRACTIONS"],
    stay: ["stay", "Travel & stays", "ROOMS & GETAWAYS"],
    travel: ["stay", "Travel & stays", "ROOMS & GETAWAYS"],
    shopping: ["shopping", "Shopping", "LOCAL FINDS"],
    family: ["kids", "Family & kids", "MAKE A FAMILY PLAN"],
    services: ["services", "Local services", "LOCAL HELP & PERKS"],
    freebies: ["free", "Freebies", "CHECK DAYS, TIMES & CONDITIONS"],
    today: ["free", "Free things to do", "CHECK EACH LISTING’S DAYS & TIMES"],
    "last-minute": [
      "last_minute",
      "Last-minute availability",
      "REAL AVAILABILITY",
    ],
    now: ["now", "Live right now", "REAL-TIME AVAILABILITY"],
  };
  const baseRender = render;
  const baseCard = card;
  function augmentMerchantTaxonomy() {
    const form = document.querySelector('#merchant-form');
    if (!form) return;
    const vertical = form.querySelector('select[name="vertical"]');
    const units = form.querySelector('select[name="inventory_unit"]');
    for (const [value, label] of [['drinks','Drinks'],['hair','Hair'],['golf','Golf'],['tourism','Tourism'],['stay','Accommodation'],['free','Free activity']]) {
      if (vertical && !vertical.querySelector(`option[value="${value}"]`)) vertical.add(new Option(label, value));
    }
    for (const [value, label] of [['diner','Diners'],['booking','Bookings'],['tee_time','Tee times'],['player','Players'],['seat','Seats'],['package','Packages']]) {
      if (units && !units.querySelector(`option[value="${value}"]`)) units.add(new Option(label, value));
    }
  }
  card = function (d) {
    const fulfil = fulfilmentLabel(d);
    return baseCard(d).replace(
      '</div></a><button class="save"',
      `<div class="meta fulfilment">${esc(fulfil)}</div></div></a><button class="save"`,
    );
  };
  const nowDrops = () =>
    cityDeals().filter((d) => {
      const start = d.offerStartsAt ? new Date(d.offerStartsAt).getTime() : NaN,
        end = d.offerEndsAt ? new Date(d.offerEndsAt).getTime() : NaN,
        now = Date.now();
      return (
        start <= now + 30 * 60000 &&
        end > now &&
        Number(d.capacityRemaining ?? 1) > 0
      );
    });
  render = function () {
    if(state.loading||state.error)return baseRender();
    if(state.route==="/tonight"||state.route==="/today"){document.title="When can I use it? | PerkDrop";$("#app").innerHTML=availabilityPage();bind();return;}
    if(state.route==="/report"){if(new URLSearchParams(location.search).has('merchant')&&!state.directoryLoaded&&!state.directoryLoading&&!state.directoryError)loadDirectory();document.title="Report incorrect information | PerkDrop";$("#app").innerHTML=reportPage();bind();return;}
    const key = state.route.slice(1);
    if (MARKET_PAGES[key]) {
      const [kind, title, eye] = MARKET_PAGES[key],
        items = key === "now" ? nowDrops() : list(kind);
      document.title = `${title} | PerkDrop`;
      $("#app").innerHTML = shell(
        `<main class="page">${searchBox()}${chips()}<section class="section"><div class="section-head"><div><div class="eyebrow">${eye}</div><h2>${title}</h2></div><span>${items.length}</span></div><div class="grid compact">${items.map(card).join("")}</div>${!items.length ? '<div class="empty">No live Drops match this view right now. Check back when a business releases capacity.</div>' : ""}</section></main>`,
        "home",
      );
      bind();
      return;
    }
    baseRender();
    augmentMerchantTaxonomy();
  };
  function business() {
    return shell(
      `<main class="page"><section class="business-hero"><div class="eyebrow">FOR LOCAL BUSINESSES & ORGANISERS</div><h1>Put unused capacity to work.</h1><p><strong>No upfront cost.</strong> Claiming is free. Any offer fees are confirmed with you before launch. You control your offer, dates and available quantity.</p><div class="business-points"><span>✓ Controlled capacity</span><span>✓ Direct bookings stay yours</span><span>✓ Fees agreed before launch</span><span>✓ Mobile verification</span></div></section><form id="merchant-form" class="merchant-form"><div class="form-grid"><label>Business / organisation *<input name="business_name" required maxlength="160"></label><label>Your name *<input name="contact_name" required maxlength="160"></label><label>Email *<input name="contact_email" type="email" required maxlength="254"></label><label>Phone *<input name="contact_phone" required maxlength="80"></label><label>Category<select name="vertical"><option value="food">Food & drink</option><option value="beauty">Beauty & wellness</option><option value="experiences">Experiences</option><option value="events">Events</option><option value="shopping">Shopping</option><option value="family_kids">Family & kids</option><option value="fitness">Health & fitness</option><option value="travel_stays">Travel & stays</option><option value="freebies">Freebies</option><option value="services">Services</option></select></label><label>How customers use the offer<select name="fulfilment_mode"><option value="external_booking">Customer books directly</option><option value="appointment">Appointment required</option><option value="direct_claim">Walk-in claim</option><option value="ticket">Ticket / session booking</option><option value="merchant_confirmation">Merchant confirmation</option></select></label><label>Availability<select name="drop_type"><option value="capacity">Planned capacity</option><option value="last_minute">Last minute</option><option value="cancellation">Cancellation / spare place</option></select></label><label>Capacity *<input name="capacity_total" required type="number" min="1" max="10000"></label><label>Capacity unit<select name="inventory_unit"><option value="person">Guests / people</option><option value="appointment">Appointments</option><option value="ticket">Tickets</option><option value="class_spot">Class spots</option><option value="room">Rooms</option><option value="item">Items</option></select></label><label>Location *<input name="location" required></label><label class="wide">Offer title *<input name="offer_title" required maxlength="180"></label><label class="wide">Customer benefit *<textarea name="description" required maxlength="2500" rows="4" placeholder="e.g. complimentary treatment add-on or value-add perk"></textarea></label><label>Start *<input name="starts_at" required type="datetime-local"></label><label>End *<input name="ends_at" required type="datetime-local"></label><label>Booking / website link<input name="booking_url" type="url"></label><label>Image URL (licensed / owned)<input name="media_url" type="url"></label><label class="wide">Conditions / minimum spend / booking instructions *<textarea name="conditions" required minlength="12" maxlength="1800" rows="3"></textarea></label><label>Redemption verifier *<input name="redemption_verifier" required maxlength="160"></label><label class="check wide"><input type="checkbox" name="authority_confirmed" required> I’m authorised to submit this offer and imagery.</label><label class="check wide"><input type="checkbox" name="accuracy_confirmed" required> Details are accurate. I understand that any commercial terms must be agreed before launch.</label><label class="check wide"><input type="checkbox" name="terms_accepted" required> I accept the PerkDrop merchant terms.</label></div><button class="btn primary submit-btn">Submit for review</button><div id="merchant-status" class="form-status"></div></form></main>`,
    );
  }
  // Re-evaluate visible time-sensitive views at minute boundaries without fetching the directory.
  setInterval(()=>{if(!document.hidden&&!document.activeElement?.matches('input,textarea,select')&&!state.loading&&!state.error&&['/','/tonight','/today'].includes(state.route))render();},60000);
  load();
})();
