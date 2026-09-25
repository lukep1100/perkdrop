import React from "react";
import Head from "next/head";
import {availabilityMatches,scheduleLabel} from "../public/availability.mjs";
const API =
  "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=500";
const TRANSIENT = new Set([408, 429, 500, 502, 503, 504]);
async function fetchCatalogue(url, init = {}) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const r = await fetch(url, { ...init, signal: init.signal || AbortSignal.timeout(10000) });
      if (r.ok || !TRANSIENT.has(r.status) || attempt === 1) return r;
      console.warn(JSON.stringify({ msg: "catalogue_dependency_retry", route: "ssr", attempt: attempt + 1, upstreamStatus: r.status }));
      await r.arrayBuffer().catch(() => {});
    } catch (error) {
      if (init.signal?.aborted) throw error;
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
    "PerkDrop — What's worth doing near you",
    "Find food, drinks, events, experiences, family plans and genuine local perks worth knowing about before you decide where to go.",
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
  "/hair": [
    "Hair Drops | PerkDrop",
    "Hair appointments and last-minute availability worth knowing about.",
  ],
  "/experiences": [
    "Experience Drops | PerkDrop",
    "Tours, tastings and experiences with genuine capacity.",
  ],
  "/activities": [
    "Activities & classes | PerkDrop",
    "Classes, golf and activities with live places where available.",
  ],
  "/golf": [
    "Golf Drops | PerkDrop",
    "Tee-time and player capacity with clear service timing.",
  ],
  "/tourism": [
    "Tourism Drops | PerkDrop",
    "Local tours and attractions with genuine capacity.",
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
  "/services": [
    "Local Services | PerkDrop",
    "Useful local services with clear availability and terms.",
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
export default function Shell({ deal, venue, collection=[], collectionCity="Adelaide", canonicalPath, expiredDeal = false, unavailable = false, missing = false }) {
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
        href: "/styles.css?v=v46-simple-offers",
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
        h("h1", null, expiredDeal ? "This offer has ended" : missing ? "Page not found" : unavailable ? "Temporarily unavailable" : deal?.title || venue?.name || "What’s worth doing near you?"),
        h("p", null, deal?.description || (deal || venue ? description : "Food, events, things to do and genuine local perks — before you make plans.")),
        h("a", {href:"/"}, "Explore current deals"),
        collection.length ? h("section",{className:"ssr-collection"},h("h2",null,`Current choices around ${collectionCity}`),h("ul",null,...collection.map(item=>h("li",{key:item.id},h("a",{href:item.href},`${item.merchant} — ${item.title}`),h("p",null,`${item.timing} · ${item.price||'Price to confirm'}`))))) : null,
        h("p", {role:"status"}, "Loading your local guide…"),
      ),
    ),
    h("script", { src: "/app.js?v=v46-simple-offers", type:"module" }),
  );
}
export async function getServerSideProps({ params, resolvedUrl, req, res }) {
  const canonicalPath = (resolvedUrl || "/").split("?")[0] || "/";
  const parts = params?.slug;
  const publicRoutes=new Set([...Object.keys(routeMeta),'/tonight','/report','/search','/weekend','/ending-soon','/near-me','/saved','/terms','/privacy','/merchant-terms','/drop-terms','/verification','/affiliate','/contact','/fitness','/wellness','/travel','/family','/services','/freebies','/today','/now']);
  if (publicRoutes.has(canonicalPath)) {
    const discoveryRoutes=['/','/events','/food','/family','/free','/weekend','/tonight','/today','/now','/near-me'];
    if(!discoveryRoutes.includes(canonicalPath))return {props:{deal:null,canonicalPath}};
    // The catalogue is loaded again by the client. Keep its optional SSR
    // collection from holding the entire page during a slow upstream response.
    if(!req?.headers?.cookie)res.setHeader('Cache-Control','public, s-maxage=30, stale-while-revalidate=60');
    try{
      const r=await fetchCatalogue(API,{headers:{accept:'application/json'},signal:AbortSignal.timeout(1800)});if(!r.ok)throw Error('catalogue_unavailable');const payload=await r.json(),deals=Array.isArray(payload)?payload:payload.deals||[];
      const city=(String(req?.headers?.cookie||'').match(/(?:^|;\s*)perkdrop_city=([a-z-]+)/)||[])[1]||'adelaide';
      const markets={adelaide:['Adelaide',-34.9285,138.6007],sydney:['Sydney',-33.8688,151.2093],melbourne:['Melbourne',-37.8136,144.9631],brisbane:['Brisbane',-27.4698,153.0251],perth:['Perth',-31.9523,115.8613],darwin:['Darwin',-12.4634,130.8456],canberra:['Canberra',-35.2809,149.13],hobart:['Hobart',-42.8821,147.3272],'gold-coast':['Gold Coast',-28.0167,153.4]},market=markets[city]||markets.adelaide;
      const when={'/weekend':'weekend','/tonight':'tonight','/today':'today','/now':'now'}[canonicalPath];
      const collection=deals.filter(d=>d.city===city||d.latitude!=null&&d.longitude!=null&&Math.abs(d.latitude-market[1])<.6&&Math.abs(d.longitude-market[2])<.7).filter(d=>!when||availabilityMatches(d,when)).filter(d=>canonicalPath==='/events'?d.kind==='event':canonicalPath==='/food'?d.vertical==='food':canonicalPath==='/family'?d.vertical==='family_kids'||/family|children|kids/i.test(d.category+' '+d.title):canonicalPath==='/free'?/^free$/i.test(d.price):true).slice(0,12).map(d=>({id:d.id,merchant:d.merchant,title:d.title,href:d.detailUrl||'/deals/'+encodeURIComponent(d.slug||d.id),timing:scheduleLabel(d),price:d.price}));
      return {props:{deal:null,canonicalPath,collection,collectionCity:market[0]}};
    }catch{return {props:{deal:null,canonicalPath}};}
  }
  const entity=Array.isArray(parts)&&parts.length===2?parts[0]:null;
  if (!['deals','venues','places'].includes(entity)) {res.statusCode=404;return {props:{deal:null,canonicalPath,missing:true}};}
  if (entity === 'places') return { props: { deal: null, canonicalPath } };
  const started=Date.now(),requestId=String(req?.headers?.['x-vercel-id']||req?.headers?.['x-request-id']||`page-${started}`).slice(0,180);
  try {
    const endpoint=entity==='venues'?`https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-business-directory?slug=${encodeURIComponent(parts[1])}`:API+'&slug='+encodeURIComponent(parts[1]);
    const r = await fetchCatalogue(endpoint, { headers: { accept: "application/json" }, ...(entity==='venues'?{signal:AbortSignal.timeout(2000)}:{}) });
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
    // The browser can load venue data with the catalogue and directory in parallel.
    // Return its shell quickly when the metadata lookup exceeds the budget.
    if(entity==='venues'&&error?.name==='TimeoutError')return {props:{deal:null,canonicalPath}};
    if(error?.message!=='catalogue_unavailable') console.warn(JSON.stringify({msg:'catalogue_dependency_error',route:canonicalPath,requestId,errorName:error?.name||'unknown',ms:Date.now()-started}));
    res.statusCode=503;res.setHeader('Retry-After','30');
    res.setHeader('X-PerkDrop-Request-Id',requestId);
    return { props: { deal: null, canonicalPath, unavailable: true } };
  }
}
