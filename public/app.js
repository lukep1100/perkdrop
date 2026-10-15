import { availabilityMatches, freshness, scheduleLabel, selectedAvailability, localClock } from '/availability.mjs?v=v39-venue-rails';
import { venueKey, legacyVenueKey } from '/venue-identity.mjs';
import { matchesOuting, suggestedDate } from '/outing-rules.mjs';
import { analyticsContext } from '/analytics.mjs';
import { PLACEHOLDER, validCoordinates, safeImage, isUnconditionallyFree, fulfilmentLabel, localDate, searchMatches } from '/discovery-rules.mjs?v=v39-venue-rails';
import {nativeShellMode,nativeNavigation,nativeSavedIds} from '/native-shell.mjs';
(() => {
  "use strict";
  const VERSION = "v49-trusted-plan-guide";
  const nativeMode=nativeShellMode(location.href,typeof window.ReactNativeWebView?.postMessage === 'function');
  if(nativeMode)document.documentElement.dataset.nativeShell=nativeMode;
  const API =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=500";
  const SUBMIT =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-merchant-submit";
  const TRACK =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-track";
  const REDEEM =
    "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-redeem";
  const UNION = "/deals/union-hotel-20-off-lunch";
  // Keep a short-lived, last-known-good catalogue for brief network/API outages.
  // Availability is time-sensitive, so this is deliberately not an indefinite offline cache.
  const CATALOGUE_CACHE_KEY = "perkdrop_catalogue_cache_v1¶»§q«^