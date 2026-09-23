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
  const merchantImage = ['merchant_authorised','licensed'].includes(merchant?.image_rights_status || '') ? merchant?.hero_image_url : '';
  return approvedImage((item.media_status === 'permission_required' ? '' : item.image_url) || merchantImage);
}
export function directoryVisible(m: any) {return Boolean(m)&&m.permanent_listing===true&&m.directory_status!=='removed';}
export function eventEnded(item: {kind?: string; ends_at?: string | null}, now = new Date()) {
  if (item.kind !== 'event' || !item.ends_at) return false;
  const end = Date.parse(item.ends_at);
  return Number.isFinite(end) && end <= now.getTime();
}
export const categoryVertical=(category: string)=>({food:'food','food & drink':'food',food_drink:'food',drinks:'drinks',events:'events',experiences:'experiences',experiences_entertainment:'experiences',shopping:'shopping',shopping_fashion:'shopping',freebies:'free',beauty:'beauty',beauty_wellness:'beauty',wellness:'wellness',hair:'hair',fitness:'fitness',fitness_sport:'fitness',activities:'activities',golf:'golf',tourism:'tourism',attractions_events:'tourism',stay:'stay',travel_accommodation:'stay',services:'services',services_other:'services'} as Record<string,string>)[String(category||'').toLowerCase()]||'other';
