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
    "PerkDrop â€” Donâ€™t make plans yet",
    "Open PerkDrop before you make plans. Find local food, events, free things to do and genuine perks with the key details clear before you go.",
  ],
  "/food": [
    "Food Drops | PerkDrop",
    "Limited food and dining Drops with real local availability.",
  ],
  ¶»§q«^