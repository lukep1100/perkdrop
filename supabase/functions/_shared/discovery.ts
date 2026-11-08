export const isAustralianPoint = (lat: unknown, lng: unknown) => lat !== null && lat !== '' && lng !== null && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat)>=-44 && Number(lat)<=-10 && Number(lng)>=112 && Number(lng)<=154;
export function localDay(state: string, now=new Date()) {
  const zone=({SA:'Australia/Adelaide',NT:'Australia/Darwin',WA:'Australia/Perth',QLD:'Australia/Brisbane',NSW:'Australia/Sydney',ACT:'Australia/Sydney',VIC:'Australia/Melbourne',TAS:'Australia/Hobart'} as Record<string,string>)[state]||'Australia/Sydney';
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function approvedImage(value: unknown) {
  try {const u=new URL(String(value||''));return u.protocol==='https:'&&!/(^|\.)unsplash\.com$/i.test(u.hostname)?u.href:'';} catch{return '';}
}
export function publicOfferImage(item: {image_url?: string | null; media_status?: string | null; metadata?: any}, merchant?: {hero_image_url?: string | null; image_rights_status?: string | null}) {
  if (item.metadata?.image_unavailable || item.metadata?.image_review_hold) return '';
  // New merchant assets carry their ledger ID into the public projection. A
  // pending/rejected/revoked asset must never leak via a stale catalogue row.
  if (item.metadata?.merchant_media_asset_id && item.metadata?.media_review_status !== 'approved') return '';
  const merchantImage = ['merchant_authorised','licensed'].includes(merchant?.image_rights_status || '') ? merchant?.hero_image_url : '';
  const itemImage = ['approved','licensed','merchant_authorised','placeholder'].includes(item.media_status || '') ? item.image_url : '';
  return approvedImage(itemImage || merchantImage);
}
export function directoryVisible(m: any) {return Boolean(m)&&m.permanent_listing===true&&m.directory_status!=='removed';}
export function listingEnded(item: {ends_at?: string | null}, now = new Date()) {
  if (!item.ends_at) return false;
  const end = Date.parse(item.ends_at);
  return Number.isFinite(end) && end <= now.getTime();
}
export function eventEnded(item: {kind?: string; ends_at?: string | null}, now = new Date()) {
  return item.kind === 'event' && listingEnded(item, now);
}
// `availability.validUntil` is the expiry of the evidence that makes a
// listing safe to show, not just a display hint. Keep it in the shared
// discovery guard so browser, native and catalogue API paths can agree.
export function evidenceEnded(item: {state?: string; availability?: {validUntil?: string | null; valid_until?: string | null} | null}, now = new Date()) {
  const until = String(item.availability?.validUntil || item.availability?.valid_until || '');
  return /^\d{4}-\d{2}-\d{2}$/.test(until) && until < localDay(String(item.state || ''), now);
}
export const accuracyHeld = (item: {metadata?: {accuracy_hold?: boolean} | null}) => item.metadata?.accuracy_hold === true;
export const categoryVertical=(category: string)=>({food:'food','food & drink':'food',food_drink:'food',drinks:'drinks',events:'events',experiences:'experiences',experiences_entertainment:'experiences',shopping:'shopping',shopping_fashion:'shopping',freebies:'free',beauty:'beauty',beauty_wellness:'beauty',wellness:'wellness',hair:'hair',fitness:'fitness',fitness_sport:'fitness',activities:'activities',golf:'golf',tourism:'tourism',attractions_events:'tourism',stay:'stay',travel_accommodation:'stay',services:'services',services_other:'services'} as Record<string,string>)[String(category||'').toLowerCase()]||'other';
