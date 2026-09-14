// Pure discovery rules shared by the public browser and server-side route metadata.
export const PLACEHOLDER = '/images/venue-unavailable.svg';
export function validCoordinates(lat, lng) {
  return lat !== null && lat !== '' && lng !== null && lng !== '' &&
    Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) &&
    Number(lat) >= -44 && Number(lat) <= -10 && Number(lng) >= 112 && Number(lng) <= 154;
}
export function safeImage(value) {
  try {
    const url = new URL(value, 'https://perkdrop.au');
    if (!['https:', 'http:'].includes(url.protocol) || /(^|\.)unsplash\.com$/i.test(url.hostname)) return PLACEHOLDER;
    return value ? url.href : PLACEHOLDER;
  } catch { return PLACEHOLDER; }
}
export function isUnconditionallyFree(deal) {
  const price = String(deal.price || '').trim().toLowerCase();
  const text = `${deal.title || ''} ${deal.conditions || ''} ${price}`.toLowerCase();
  if (/with (a |an |any )?(purchase|paying|paid|adult|main|meal)|buy one|buy 1|minimum spend|kids eat free|children eat free/.test(text)) return false;
  return /^(free|\$0(?:\.00)?)(?:\s*(entry|admission|event|tickets?))?$/i.test(price) || /free (entry|admission)/.test(text);
}
export function fulfilmentLabel(deal) {
  if (!deal.redemptionAvailable && !deal.merchantOfferId) return 'View official offer';
  return {direct_claim:'Claim a pass',booking_claim:'Booking required',external_booking:'Book with the venue',ticket:'Ticket booking',appointment:'Appointment required',merchant_confirmation:'Venue confirmation required',information_only:'View details'}[deal.fulfilmentMode] || 'Check details';
}
export function localDate(state, now = new Date()) {
  const zone = {SA:'Australia/Adelaide',NT:'Australia/Darwin',WA:'Australia/Perth',QLD:'Australia/Brisbane',NSW:'Australia/Sydney',ACT:'Australia/Sydney',VIC:'Australia/Melbourne',TAS:'Australia/Hobart'}[state] || 'Australia/Sydney';
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function searchMatches(value, query) {
  const normalize = s => String(s || '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
  const haystack = normalize(value);
  let q=normalize(query).replace(/free stuff/g,'free').replace(/things to do/g,'experience').replace(/date night/g,'dining').replace(/cheap dinner/g,'meal').replace(/near me/g,'');
  const synonyms={schnitty:['schnitzel','schnitty'],schnitzel:['schnitzel','schnitty'],family:['family','families','kids','children'],kids:['kids','children','family'],pub:['pub','tavern','hotel','bar'],dining:['dining','restaurant','wine','pasta','pizza'],meal:['meal','food','pizza','pasta','schnitzel','dining'],experience:['experience','event','gallery','museum','garden','festival','arcade','tour'],cbd:['cbd','5000','city centre']};
  return q.split(' ').filter(Boolean).every(term=>(synonyms[term]||[term]).some(word=>haystack.includes(word)));
}
