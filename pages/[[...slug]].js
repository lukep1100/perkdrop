import React from "react";
import Head from "next/head";
const API =
  "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200";
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
async function fetchCatalogue(url, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { ...init, signal: AbortSignal.timeout(10000) });
      if (r.ok || !TRANSIENT.has(r.status) || attempt === 1) return r;
      console.warn(JSON.stringify({ msg: "catalogue_dependency_retry", route: "ssr", attempt: attempt + 1, upstreamStatus: r.status }));
      await r.arrayBuffer().catch(() => {});
    } catch (error) {
      if (attempt === 1) throw error;
      console.warn(JSON.stringify({ msg: "catalogue_dependency_retry", route: "ssr", attempt: attempt + 1, errorName: error?.name || "unknown" }));
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw Error("catalogue_unavailable");
}
const SITE = "https://perkdrop.au";
const routeMeta = {
  "/": [
    "PerkDrop — Local deals, free events and things to do",
    "Find food deals, free events and things to do near you. See the price, location and conditions before you go.",
  ],
  "/food": [
    "Food Drops | PerkDrop",
    "Limited food and dining Drops with real local availability.",
  ],
  "/drinks": [
    "Drink specials | PerkDrop",
    "Limited drink Drops and venue opportunities worth knowing about.",
  ],
  "/events": [
    "Event Drops | PerkDrop",
    "Tickets and event capacity worth knowing about near you.",
  ],
  "/beauty": [
    "Beauty Drops | PerkDrop",
    "Appointment and self-care Drops with real availability.",
  ],
  "/experiences": [
    "Experience Drops | PerkDrop",
    "Tours, tastings and experiences with genuine capacity.",
  ],
  "/activities": [
    "Activities & classes | PerkDrop",
    "Classes, golf and activities with live places where available.",
  ],
  "/stay": [
    "Stay Drops | PerkDrop",
    "Rooms and local stays with real inventory and clear terms.",
  ],
  "/last-minute": [
    "Last-minute Drops | PerkDrop",
    "Local opportunities ending soon or released at short notice.",
  ],
  "/free": [
    "Free Drops | PerkDrop",
    "Free local events, experiences and opportunities worth knowing about.",
  ],
  "/kids": [
    "Kids & family deals | PerkDrop",
    "Family-friendly Drops and local opportunities worth knowing about.",
  ],
  "/shopping": [
    "Shopping Drops | PerkDrop",
    "Limited retail and perishable inventory Drops worth knowing about.",
  ],
  "/map": [
    "PerkDrop map",
    "Explore nearby Drops and venues with real availability where supported.",
  ],
  "/business": [
    "Create a Drop | PerkDrop",
    "Release unused capacity, appointments, tickets or inventory with PerkDrop.",
  ],
  "/about": [
    "About PerkDrop",
    "PerkDrop helps local businesses move expiring capacity and measure delivered value.",
  ],
};
export default function Shell({ deal, venue, canonicalPath, expiredDeal = false, unavailable = false, missing = false }) {
  const h = React.createElement,
    meta = (venue ? [`${venue.name} | PerkDrop`, `${venue.name}${venue.location ? ' — '+venue.location : ''}. View business details and current offers. Check conditions with the venue.`] : routeMeta[canonicalPath]) || [
      "PerkDrop — Deals near you",
      "Deals worth knowing about.",
    ];
  const title = deal
    ? `${deal.merchant} — ${deal.title} | PerkDrop`
    : expiredDeal
      ? "This Drop has ended | PerkDrop"
      : meta[0];
  const description = deal
    ? deal.description || `${deal.title} at ${deal.merchant}.`
    : expiredDeal
      ? "This Drop is no longer available. Explore current nearby PerkDrop offers."
      : meta[1];
  const canonical = deal
    ? `${SITE}/deals/${encodeURIComponent(deal.slug)}`
    : `${SITE}${canonicalPath || "/"}`;
  return h(
    React.Fragment,
    null,
    h(
      Head,
      null,
      h("meta", { charSet: "utf-8" }),
      h("meta", {
        name: "viewport",
        content:
          "width=device-width,initial-scale=1,viewport-fit=cover",
      }),
      h("meta", { name: "theme-color", content: "#08090e" }),
      h("meta", { name: "description", content: description }),
      (expiredDeal || missing || unavailable)
        ? h("meta", { name: "robots", content: "noindex,follow" })
        : null,
      h("link", { rel: "canonical", href: canonical }),
      h("meta", { property: "og:type", content: "website" }),
      h("meta", { property: "og:site_name", content: "PerkDrop" }),
      h("meta", { property: "og:title", content: title }),
      h("meta", { property: "og:description", content: description }),
      h("meta", { property: "og:url", content: canonical }),
      deal?.image
        ? h("meta", { property: "og:image", content: deal.image })
        : null,
      h("meta", {
        name: "twitter:card",
        content: deal?.image ? "summary_large_image" : "summary",
      }),
      h("meta", { name: "twitter:title", content: title }),
      h("meta", { name: "twitter:description", content: description }),
      deal?.image
        ? h("meta", { name: "twitter:image", content: deal.image })
        : null,
      h("link", { rel: "manifest", href: "/manifest.webmanifest" }),
      h("link", { rel: "icon", href: "/icon.svg" }),
      h("title", null, title),
      h("link", {
        href: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap",
        rel: "stylesheet",
      }),
      h("link", {
        rel: "stylesheet",
        href: "/styles.css?v=v33-local-pilot",
      }),
    ),
    h(
      "div",
      { id: "app", "data-expired-deal": expiredDeal ? "true" : "false", "data-missing":missing ? "true":"false" },
      h(
        "main",
        { className: "boot" },
        h("img", { src: "/icon.svg", className: "boot-icon", alt: "" }),
        h("div", { className: "boot-logo" }, "Perk", h("span", null, "Drop")),
        h("h1", null, expiredDeal ? "This offer has ended" : missing ? "Page not found" : unavailable ? "Temporarily unavailable" : deal?.title || venue?.name || "Local deals, free events and things to do"),
        h("p", null, deal?.description || description),
        h("a", {href:"/"}, "Explore current deals"),
        h("p", {role:"status"}, "Loading live availability…"),
      ),
    ),
    h("script", { src: "/app.js?v=v33-local-pilot", type:"module" }),
  );
}
export async function getServerSideProps({ params, resolvedUrl, req, res }) {
  const canonicalPath = (resolvedUrl || "/").split("?")[0] || "/";
  const parts = params?.slug;
  const publicRoutes=new Set([...Object.keys(routeMeta),'/tonight','/report','/search','/weekend','/ending-soon','/near-me','/saved','/terms','/privacy','/merchant-terms','/drop-terms','/verification','/affiliate','/contact','/fitness','/wellness','/travel','/family','/services','/freebies','/today','/now']);
  if (publicRoutes.has(canonicalPath)) return {props:{deal:null,canonicalPath}};
  const entity=Array.isArray(parts)&&parts.length===2?parts[0]:null;
  if (!['deals','venues'].includes(entity)) {res.statusCode=404;return {props:{deal:null,canonicalPath,missing:true}};}
  const started=Date.now(),requestId=String(req?.headers?.['x-vercel-id']||req?.headers?.['x-request-id']||`page-${started}`).slice(0,180);
  try {
    const endpoint=entity==='venues'?`https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-business-directory?slug=${encodeURIComponent(parts[1])}`:API+'&slug='+encodeURIComponent(parts[1]);
    const r = await fetchCatalogue(endpoint, { headers: { accept: "application/json" } });
    if(r.status===410){res.statusCode=410;return{props:{deal:null,canonicalPath,expiredDeal:true}};}
    if(r.status===404){res.statusCode=404;return{props:{deal:null,canonicalPath,missing:true}};}
    if (!r.ok) { console.warn(JSON.stringify({msg:'catalogue_dependency_failed',route:canonicalPath,requestId,upstreamStatus:r.status,upstreamRequestId:r.headers.get('x-perkdrop-request-id')||null,upstreamFailure:r.headers.get('x-perkdrop-query-failure')||null,upstreamQueryMs:r.headers.get('x-perkdrop-query-ms')||null,ms:Date.now()-started})); throw Error('catalogue_unavailable'); }
    if(entity==='venues') {const j=await r.json();if(!j.businesses?.length){res.statusCode=404;return{props:{deal:null,canonicalPath,missing:true}};}const b=j.businesses[0];return{props:{deal:null,venue:{name:b.name,location:b.location||''},canonicalPath}};}
    const p = await r.json(),
      deals = Array.isArray(p) ? p : p.deals || [],
      requested = parts[1],
      m = deals.find(
        (x) => x.slug === requested || x.detailUrl === `/deals/${requested}`,
      );
    if (!m) {res.statusCode=404;return { props: { deal: null, canonicalPath, missing: true } };}
    return {
      props: {
        canonicalPath,
        deal: {
          slug: m.slug || requested,
          title: m.title || "Drop",
          merchant: m.merchant || "Local venue",
          description: m.description || m.conditions || "",
          image: m.image || m.imageUrl || m.mediaUrl || "",
        },
      },
    };
  } catch (error) {
    if(error?.message!=='catalogue_unavailable') console.warn(JSON.stringify({msg:'catalogue_dependency_error',route:canonicalPath,requestId,errorName:error?.name||'unknown',ms:Date.now()-started}));
    res.statusCode=503;res.setHeader('Retry-After','30');
    res.setHeader('X-PerkDrop-Request-Id',requestId);
    return { props: { deal: null, canonicalPath, unavailable: true } };
  }
}
