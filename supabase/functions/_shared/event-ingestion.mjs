// Shared by the scheduled worker and its offline regression tests.
export const FALLBACK = 'https://perkdrop.au/images/venue-unavailable.svg';
export const ZONES = {SA:'Australia/Adelaide',NT:'Australia/Darwin',WA:'Australia/Perth',QLD:'Australia/Brisbane',NSW:'Australia/Sydney',ACT:'Australia/Sydney',VIC:'Australia/Melbourne',TAS:'Australia/Hobart'};
export const text = v => typeof v === 'string' ? v.trim() : '';
const array = v => Array.isArray(v) ? v : v == null ? [] : [v];
export function cleanText(v) {
  return text(v).replace(/<[^>]*>/g,' ').replace(/&amp;/gi,'&').replace(/&nbsp;/gi,' ').replace(/&#39;|&apos;/gi,"'").replace(/&quot;/gi,'"').replace(/\s+/g,' ').trim();
}
export function stateCode(v) {
  const s = text(v).toUpperCase().replace(/[^A-Z]/g,'');
  return ({SOUTHAUSTRALIA:'SA',NORTHERNTERRITORY:'NT',WESTERNAUSTRALIA:'WA',QUEENSLAND:'QLD',NEWSOUTHWALES:'NSW',VICTORIA:'VIC',TASMANIA:'TAS',AUSTRALIANCAPITALTERRITORY:'ACT'})[s] || (ZONES[s] ? s : '');
}
export function safeUrl(raw, base) {
  if (!text(raw)) return '';
  try {
    const u = new URL(raw,base);
    if (u.protocol !== 'https:' || u.username || u.password || u.port || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/i.test(u.hostname)) return '';
    u.hash = '';
    for (const k of [...u.searchParams.keys()]) if (/^utm_|fbclid|gclid/i.test(k)) u.searchParams.delete(k);
    return u.href;
  } catch { return ''; }
}
export function parseStructuredEvents(html) {
  const roots = [];
  try { roots.push(JSON.parse(html)); } catch { /* HTML is the normal input. */ }
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { roots.push(JSON.parse(m[1].trim().replace(/^<!--|-->$/g,''))); } catch { /* Other scripts can still be valid. */ }
  }
  const events = [], seen = new Set();
  function visit(v) {
    if (Array.isArray(v)) { v.forEach(visit); return; }
    if (!v || typeof v !== 'object') return;
    if (array(v['@type']).some(t => /(?:^|[/#])(?:[A-Za-z]*Event)$/.test(String(t)))) {
      const key = `${v.name}|${v.startDate}|${v.endDate}|${v.url}`;
      if (!seen.has(key)) { events.push(v); seen.add(key); }
    }
    for (const [k,val] of Object.entries(v)) if (k !== '@context' && val && typeof val === 'object') visit(val);
  }
  roots.forEach(visit);
  return events;
}
function localParts(ms,zone) {
  return Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(new Date(ms)).map(p=>[p.type,p.value]));
}
// Date-only and offset-less values are venue-local, never the server's UTC day.
export function eventInstant(raw, zone, endOfDay = false) {
  const s = text(raw), m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return /T.*(?:Z|[+-]\d{2}:?\d{2})$/i.test(s) && Number.isFinite(Date.parse(s)) ? Date.parse(s) : NaN;
  const [y,mo,d,h,mi,se] = [+m[1],+m[2],+m[3],+(m[4]||0),+(m[5]||0),+(m[6]||0)];
  const check = new Date(Date.UTC(y,mo-1,d));
  if (check.getUTCFullYear()!==y || check.getUTCMonth()!==mo-1 || check.getUTCDate()!==d || h>23 || mi>59 || se>59) return NaN;
  let wall = Date.UTC(y,mo-1,d,h,mi,se);
  if (endOfDay && !m[4]) wall += 86400000;
  let result = wall;
  for (let i=0;i<4;i++) {
    const p=localParts(result,zone),represented=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);
    const next=result+wall-represented;
    if(next===result) break;
    result=next;
  }
  const p=localParts(result,zone);
  if(Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second)!==wall) return NaN;
  return result;
}
export function eventPricing(offers,isAccessibleForFree) {
  const all = array(offers).flatMap(o=>o ? [o,...array(o.offers)] : []);
  const numbers = all.flatMap(o=>[o.price,o.lowPrice,o.highPrice].filter(v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Number(v)>=0).map(Number));
  const currency = all.map(o=>text(o.priceCurrency)).find(Boolean) || 'AUD';
  const positive = numbers.filter(n=>n>0);
  if (positive.length) {
    const min=Math.min(...positive);
    return {priceText:numbers.includes(0)?`Free and paid options — check organiser`:`From ${currency} $${min.toFixed(2)}`,priceKind:numbers.includes(0)?'mixed':'paid',priceVerified:true};
  }
  // A single zero-price tier does not establish that an umbrella event is free.
  if (isAccessibleForFree===true && (!numbers.length || numbers.every(n=>n===0))) return {priceText:'FREE',priceKind:'free',priceVerified:true};
  if (numbers.length && numbers.every(n=>n===0)) return {priceText:'$0 option listed — check organiser for conditions',priceKind:'zero_option',priceVerified:true};
  return {priceText:'Check organiser for pricing',priceKind:'unknown',priceVerified:false};
}
export function normalizeEvent(e,source,merchant,now=Date.now(),venues=[]) {
  const loc=array(e.location).find(l=>l && l['@type']!=='VirtualLocation') || {}, a=loc.address || {};
  const state=stateCode(typeof a==='object'?a.addressRegion:'') || stateCode(merchant.primary_state);
  const timezone=ZONES[state];
  if (!timezone || /onlineeventattendancemode/i.test(text(e.eventAttendanceMode))) return null;
  const title=cleanText(e.name), startRaw=text(e.startDate), endRaw=text(e.endDate);
  const starts=eventInstant(startRaw,timezone), ends=eventInstant(endRaw || startRaw.slice(0,10),timezone,true);
  if (!title || !Number.isFinite(starts) || !Number.isFinite(ends) || ends<=starts || ends<=now || starts>now+180*86400000) return null;
  const address=typeof a==='string'?cleanText(a):[a.streetAddress,a.addressLocality,a.addressRegion,a.postalCode].map(cleanText).filter(Boolean).join(', ');
  const location=[cleanText(loc.name),address].filter(Boolean).join(', ');
  const sameVenue=!!text(loc.name) && cleanText(loc.name).toLowerCase()===cleanText(merchant.name).toLowerCase();
  const coord=v=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))?Number(v):null;
  const key=s=>cleanText(s).toLowerCase().replace(/[^a-z0-9]/g,'');
  const known=venues.find(v=>v.state===state&&key(v.address)&&[key(address),key(location)].includes(key(v.address)));
  const lat=coord(loc.geo?.latitude) ?? coord(known?.latitude) ?? (sameVenue?coord(merchant.latitude):null);
  const lng=coord(loc.geo?.longitude) ?? coord(known?.longitude) ?? (sameVenue?coord(merchant.longitude):null);
  const geo=lat!==null&&lng!==null&&lat>=-44&&lat<=-10&&lng>=112&&lng<=154;
  const canonical=safeUrl(e.url || e['@id'],source.source_url) || source.source_url;
  const sameHost=new URL(canonical).hostname.replace(/^www\./,'')===new URL(source.source_url).hostname.replace(/^www\./,'');
  const ownPage=sameHost && canonical.replace(/^https:\/\/www\./,'https://').replace(/\/$/,'')===source.source_url.replace(/^https:\/\/www\./,'https://').replace(/\/$/,'');
  // Related-event widgets must not be attributed to the currently checked event.
  const pageTitle=cleanText(source.page_title).toLowerCase();
  const titleMatchesPage=pageTitle.includes(title.toLowerCase()) || title.toLowerCase().includes(pageTitle.replace(/\s*[|—–].*$/,''));
  if (!sameHost || (source.is_detail && !ownPage) || (source.is_detail && pageTitle && !titleMatchesPage)) return null;
  const pricing=eventPricing(e.offers,e.isAccessibleForFree);
  const status=text(e.eventStatus),availability=array(e.offers).map(o=>text(o?.availability)).join(' ');
  const unavailable=/cancelled|postponed|rescheduled/i.test(status)||/soldout|discontinued/i.test(availability);
  const endParts=localParts(ends-1,timezone), endDate=`${endParts.year}-${endParts.month}-${endParts.day}`;
  const fmt=ms=>new Intl.DateTimeFormat('en-AU',{timeZone:timezone,dateStyle:'medium',...(/T/.test(startRaw)?{timeStyle:'short'}:{})}).format(new Date(ms));
  const timing=`${fmt(starts)} – ${fmt(ends-(/T/.test(endRaw)?0:1))}`;
  const city=text(merchant.primary_city)||cleanText(a.addressLocality).toLowerCase().replace(/\s+/g,'-');
  // Unknown prices can be listed honestly without implying free entry or a discount.
  const eligible=!!(geo&&location&&city&&!unavailable&&source.authoritative);
  return {title,summary:cleanText(e.description).slice(0,1800),starts_at:new Date(starts).toISOString(),ends_at:new Date(ends).toISOString(),price_text:pricing.priceText,unavailable,metadata:{event_url:canonical,timezone,end_date:endDate,location,city,state,latitude:lat,longitude:lng,timing,structured_event:true,detected_by:'perkdrop-event-watch-v3',price_kind:pricing.priceKind,price_verified:pricing.priceVerified,booking_required:array(e.offers).some(o=>!!text(o?.url)),booking_url:safeUrl(array(e.offers).map(o=>text(o?.url)).find(Boolean)||canonical,source.source_url),event_status:status,availability,auto_publish_eligible:eligible,verification_issue:!geo?'missing_verified_coordinates':!location?'missing_location':'',image_url:FALLBACK,image_alt:'PerkDrop neutral event image',image_rights_status:'perkdrop_owned_fallback',media_fallback:true,media_status:'placeholder',venue_type:'event venue'}};
}
export function eventLinks(html,base,limit=15) {
  const urls=new Map(),origin=new URL(base),path=u=>u.pathname.replace(/\/$/,'');
  const add=(raw,structured=false)=>{const url=safeUrl(raw,base);if(!url)return;const u=new URL(url);if(u.hostname!==origin.hostname || path(u)===path(origin) || !/\/(?:events?|whats-on|whatson)\/[^/?#]+/i.test(u.pathname) || /\.(?:jpg|png|pdf|ics|svg)$/i.test(u.pathname) || /\/(?:category|tag|feed|page)\//i.test(u.pathname))return;
    const priority=structured?0:/\/events?\/[^/?#]+/i.test(u.pathname)?1:2;
    urls.set(url,Math.min(urls.get(url)??Infinity,priority));
  };
  // Site-wide navigation must not consume the bounded child-page allowance.
  const content=(html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]||html).replace(/<(header|nav|footer)\b[^>]*>[\s\S]*?<\/\1>/gi,'');
  for(const m of content.matchAll(/<a\b[^>]*href\s*=\s*["']([^"']+)["']/gi)) add(m[1].replace(/&amp;/g,'&'));
  for(const e of parseStructuredEvents(html)) add(e.url||e['@id'],true);
  return [...urls].sort((a,b)=>a[1]-b[1]).slice(0,limit).map(([url])=>url);
}
// A programme gets one card, showing its next live occurrence. Retain the other
// verified sessions as evidence rather than inventing continuous opening hours.
export function nextOccurrences(events,now=Date.now()) {
  const groups=new Map();
  for(const event of events){if(!event)continue;const key=`${event.metadata.event_url}|${event.title.toLowerCase()}`;if(!groups.has(key))groups.set(key,[]);groups.get(key).push(event);}
  return [...groups.values()].map(all=>{
    const short=all.filter(e=>Date.parse(e.ends_at)-Date.parse(e.starts_at)<=86400000);
    const choices=(short.length?short:all).filter(e=>Date.parse(e.ends_at)>now).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
    if(!choices.length)return null;
    const chosen=choices[0];
    return {...chosen,metadata:{...chosen.metadata,occurrences:choices.map(e=>({starts_at:e.starts_at,ends_at:e.ends_at})),timing:chosen.metadata.timing+(choices.length>1?' · More dates on organiser site':'')}};
  }).filter(Boolean);
}
