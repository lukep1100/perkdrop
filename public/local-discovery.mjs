import { validCoordinates, listingEnded, isUnconditionallyFree, searchMatches } from './discovery-rules.mjs';
import { availabilityMatches, freshness } from './availability.mjs';
import { venueKey } from './venue-identity.mjs';

export const RADIUS_STEPS = [1, 5, 10, 25, 50, 75, 100, 150, 200];
export function searchRadius(value, fallback = 25) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.min(200, Math.max(1, Math.round(n))) : fallback;
}
export function validOrigin(value) {
  return value && validCoordinates(value.latitude ?? value.lat, value.longitude ?? value.lng);
}
export function distanceFrom(item, origin) {
  if (!validOrigin(origin) || !validCoordinates(item?.latitude, item?.longitude)) return null;
  const lat = Number(origin.latitude ?? origin.lat), lng = Number(origin.longitude ?? origin.lng);
  const rad = Math.PI / 180, a = Number(item.latitude), b = Number(item.longitude);
  const h = Math.sin((a-lat)*rad/2)**2 + Math.cos(lat*rad)*Math.cos(a*rad)*Math.sin((b-lng)*rad/2)**2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}
export function distanceLabel(item, origin) {
  const km = distanceFrom(item, origin);
  return km === null ? '' : km < 1 ? `${Math.round(km*1000)} m` : km < 10 ? `${km.toFixed(1)} km` : `${Math.round(km)} km`;
}
export function inSearchArea(item, origin) {
  if (!origin) return true;
  const km = distanceFrom(item, origin);
  return km !== null && km <= searchRadius(origin.radius);
}
export function currentListing(item, now = new Date()) {
  return item && item.active !== false && item.publicVisible !== false &&
    !['expired','cancelled','canceled','withdrawn'].includes(item.lifecycleStatus || item.lifecycle_status) &&
    !['cancelled','canceled','postponed'].includes(item.availability?.status) &&
    !listingEnded(item, now);
}
export function uniquePlaces(items, limit = Infinity) {
  const seen = new Set();
  return items.filter(item => { const key = venueKey(item); if (seen.has(key)) return false; seen.add(key); return true; }).slice(0, limit);
}
export function nearestFirst(items, origin) {
  return [...items].sort((a,b) => (distanceFrom(a,origin) ?? Infinity) - (distanceFrom(b,origin) ?? Infinity));
}
export function mergeDiscoveryListings(base, focused, now = new Date()) {
  const seen=new Set();
  return [...focused,...base].filter(item=>{if(!item?.id||seen.has(item.id)||!currentListing(item,now))return false;seen.add(item.id);return true;}).slice(0,500);
}
export function widerArea(items, origin, now = new Date()) {
  if (!validOrigin(origin)) return null;
  const radius = searchRadius(origin.radius);
  const distances = uniquePlaces(items.filter(item => currentListing(item, now))).map(item => ({item,km:distanceFrom(item,origin)})).filter(x => x.km !== null && x.km > radius && x.km <= 200).sort((a,b)=>a.km-b.km);
  if (!distances.length) return null;
  const nextRadius = RADIUS_STEPS.find(step => step > radius && step >= distances[0].km) || 200;
  return {radius:nextRadius, nearestKm:distances[0].km, count:distances.filter(x=>x.km<=nextRadius).length, items:distances.filter(x=>x.km<=nextRadius).map(x=>x.item)};
}
export function discoveryMatches(item, {query='', category='All', when='any'} = {}, now = new Date()) {
  if (!currentListing(item, now)) return false;
  const text = [item.title,item.merchant,item.description,item.location,item.city,item.category,item.vertical,item.kind,item.cuisine,item.venueType].join(' ');
  if (query && !searchMatches(text, query)) return false;
  if (when !== 'any' && !availabilityMatches(item, when, now)) return false;
  if (category === 'Free') return isUnconditionallyFree(item);
  const patterns = {Food:/food|dining|restaurant|cafe|café|bakery/,Drinks:/drink|bar|pub/,Events:/event|festival|exhibition|market|performance/,Beauty:/beauty|hair|wellness/,Experiences:/experience|activity|tour|museum|gallery/,Family:/family|kids|children|all ages/};
  // Category uses taxonomy and title, never unrelated conditions such as "no drinks".
  return !patterns[category] || patterns[category].test([item.category,item.vertical,item.kind,item.title].join(' ').toLowerCase());
}
export function discoveryCollections(items, {origin=null, savedIds=[]} = {}, now = new Date()) {
  const eligible = items.filter(item => currentListing(item, now) && ['A','B'].includes(item.qualityGrade) && freshness(item,now).state === 'recent');
  const saved = new Set(savedIds), interests = new Set(items.filter(item=>saved.has(item.id)).map(item=>item.vertical||item.category));
  const score = item => (interests.has(item.vertical||item.category)?30:0) + (availabilityMatches(item,'week',now)?18:0) + (isUnconditionallyFree(item)?8:0) + (item.featured?6:0) - Math.min(25,(distanceFrom(item,origin)??100)/8);
  const ranked = [...eligible].sort((a,b)=>score(b)-score(a) || String(a.id).localeCompare(String(b.id)));
  return {
    free: uniquePlaces(nearestFirst(eligible.filter(item=>isUnconditionallyFree(item)&&availabilityMatches(item,'week',now)),origin),8),
    week: uniquePlaces(ranked.filter(item=>availabilityMatches(item,'week',now)),8),
    suggested: uniquePlaces(ranked.filter(item=>!saved.has(item.id)),8),
    personalised: interests.size > 0,
  };
}
