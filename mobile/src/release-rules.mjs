// Pure, shared release rules. No device identifiers or credentials are logged here.
export const SITE = 'https://perkdrop.au';
const HOSTS = new Set(['perkdrop.au', 'www.perkdrop.au']);
const SLUG = /^[a-z0-9][a-z0-9_-]{0,239}$/i;
export function safeWebUrl(value, base = SITE) {
  if (typeof value !== 'string' || !value.trim() || value.length > 4096 || /[\u0000-\u001f\\]/.test(value)) return null;
  try {
    const u = new URL(value.trim(), base);
    if (!['https:', 'http:'].includes(u.protocol) || u.username || u.password) return null;
    return u.href;
  } catch { return null; }
}
export function campaignFromUrl(value) {
  try {
    const u = new URL(value), result = {};
    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content']) {
      const v = u.searchParams.get(key);
      if (v && /^[a-z0-9 _.-]{1,100}$/i.test(v)) result[key] = v;
    }
    return result;
  } catch { return {}; }
}
export function parseIncomingLink(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u0020\\]/.test(value)) return null;
  try {
    const u = new URL(value);
    if (u.username || u.password || u.port) return null;
    const custom = u.protocol === 'perkdrop:';
    if (!custom && !(u.protocol === 'https:' && HOSTS.has(u.hostname))) return null;
    const path = custom ? '/' + u.hostname + u.pathname : u.pathname;
    if (path === '/connect' || path === '/connect-device') {
      if (!/^[a-f0-9]{64}$/.test(u.hash.slice(1)) || u.search) return null;
      return { kind: 'connect', token: u.hash.slice(1) };
    }
    if (u.hash) return null;
    const match = /^\/deals\/([^/]+)\/?$/.exec(path);
    if (!match) return null;
    const slug = decodeURIComponent(match[1]);
    if (!SLUG.test(slug)) return null;
    return { kind: 'deal', slug, path: '/deals/' + slug, campaign: campaignFromUrl(value) };
  } catch { return null; }
}
export function notificationLink(data, now = Date.now()) {
  if (!data || typeof data !== 'object') return null;
  const expires = Date.parse(data.expiresAt);
  if (!Number.isFinite(expires) || expires <= now) return null;
  const link = parseIncomingLink(data.url);
  return link?.kind === 'deal' ? link : null;
}
export function listingEnded(item, now = Date.now()) {
  if (!item || item.active === false || ['expired', 'cancelled', 'withdrawn'].includes(item.lifecycle_status || item.lifecycleStatus)) return true;
  const end = item.ends_at || item.endsAt || item.end || item.end_date;
  if (!end) return false;
  if (/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    const zone = item.timezone || item.availability?.timezone;
    if (!zone) return false;
    try {
      const parts = new Intl.DateTimeFormat('en', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
      const part = type => parts.find(p => p.type === type)?.value;
      return end < `${part('year')}-${part('month')}-${part('day')}`;
    } catch { return false; }
  }
  const time = Date.parse(end);
  return Number.isFinite(time) && time <= now;
}
export function decodeCatalogueCache(text, now = Date.now()) {
  if (typeof text !== 'string' || text.length > 3_000_000) return null;
  try {
    const cache = JSON.parse(text);
    if (cache.version !== 1 || !Number.isFinite(cache.savedAt) || cache.savedAt > now + 60_000 || now - cache.savedAt > 24 * 3600_000 || !Array.isArray(cache.items) || cache.items.length > 1000) return null;
    return { savedAt: cache.savedAt, items: cache.items.filter(item => item && typeof item === 'object' && !listingEnded(item, now)).map(item => ({ ...item, redemptionAvailable: false, redemption_available: false, capacityRemaining: 0, capacity_remaining: 0 })) };
  } catch { return null; }
}
export function passTime(value, timezone) {
  if (!value || !Number.isFinite(Date.parse(value))) return 'Check the pass details';
  if (!timezone) return new Date(value).toISOString();
  try { return new Intl.DateTimeFormat('en-AU', { timeZone: timezone, dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
  catch { return new Date(value).toISOString(); }
}
export function validPushToken(value) {
  return typeof value === 'string' && /^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(value);
}
export function pushPreferences(input = {}) {
  const city = String(input.city || '').trim().toLowerCase();
  const cities = ['adelaide', 'sydney', 'melbourne', 'brisbane', 'perth', 'darwin', 'canberra', 'hobart', 'gold-coast'];
  const timezone = String(input.timezone || 'Australia/Adelaide');
  try { new Intl.DateTimeFormat('en-AU', { timeZone: timezone }); } catch { throw Error('invalid_timezone'); }
  if (!cities.includes(city)) throw Error('Choose a supported city for notifications.');
  return { city, timezone, frequency: 'weekly', quiet_start: 20, quiet_end: 8, daily_cap: 1 };
}
export function canDeliverPush(preferences, now = Date.now(), lastSentAt = null) {
  try {
    const hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone: preferences.timezone, hour: '2-digit', hourCycle: 'h23' }).format(now));
    const start = preferences.quiet_start ?? 20, end = preferences.quiet_end ?? 8;
    const quiet = start > end ? hour >= start || hour < end : hour >= start && hour < end;
    const last = lastSentAt == null ? null : Date.parse(lastSentAt);
    return !quiet && (last === null || (Number.isFinite(last) && now - last >= 7 * 86400_000));
  } catch { return false; }
}
