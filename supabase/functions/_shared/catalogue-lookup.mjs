// Include parent slugs for expanded multi-location detail links. Query the
// indexed candidates directly; a bounded scan of unrelated rows loses new items.
export function catalogueSlugFilter(slug) {
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(slug)) return null;
  const parts = slug.split('-');
  const prefixes = [...new Set(parts.map((_,i)=>parts.slice(0,i+1).join('-')))];
  return `slug.in.(${prefixes.join(',')}),detail_url.eq./deals/${slug},detail_url.eq.https://perkdrop.au/deals/${slug},detail_url.eq.https://www.perkdrop.au/deals/${slug}`;
}

// Coordinates are used only to select public candidates; all ordinary visibility,
// expiry, evidence and merchant guards still run during catalogue enrichment.
export function catalogueArea(params) {
  if(!['lat','lng','radius_km'].some(key=>params.has(key)))return null;
  const lat=Number(params.get('lat')),lng=Number(params.get('lng'));
  const radius=Number(params.get('radius_km')||200);
  if(!params.get('lat')?.trim()||!params.get('lng')?.trim()||!Number.isFinite(lat)||!Number.isFinite(lng)||lat < -44||lat > -10||lng < 112||lng > 154||!Number.isFinite(radius)||radius<=0)throw new RangeError('valid_australian_area_required');
  return {lat,lng,radius:Math.min(200,Math.max(1,radius))};
}
