// Presentation and public navigation only. This grants no account or API access.
const SITE = 'https://perkdrop.au';
export function nativeShellMode(value, bridgeAvailable) {
  if (!bridgeAvailable) return '';
  try {
    const u = new URL(value);
    if (u.username || u.password) return '';
    const mode = u.searchParams.get('native');
    return u.origin === SITE && (mode === 'sheet' || (mode === 'map' && u.pathname === '/map')) ? mode : '';
  } catch { return ''; }
}
export function nativePageUrl(value, mode) {
  if (!['map', 'sheet'].includes(mode)) return null;
  try {
    const u = new URL(value, SITE);
    if (u.origin !== SITE || u.username || u.password || (mode === 'map' && u.pathname !== '/map')) return null;
    u.searchParams.set('native', mode);
    return u.href;
  } catch { return null; }
}
export function nativeNavigation(value) {
  if (typeof value !== 'string' || value.length > 4096 || /[\u0000-\u001f\\]/.test(value)) return null;
  try {
    const u = new URL(value, SITE);
    if (u.origin !== SITE || u.username || u.password) return null;
    const path = u.pathname;
    if (path === '/map') return {kind:'map', url:SITE + '/map'};
    if (path === '/saved' || (path === '/my-perks' && u.searchParams.get('tab') === 'saved')) return {kind:'saved'};
    if (['/','/search','/near-me','/food','/drinks','/events','/free','/freebies','/kids','/family','/beauty','/hair','/experiences','/activities','/golf','/tourism','/shopping','/stay','/travel','/wellness','/now','/today','/tonight','/weekend','/last-minute'].includes(path)) {
      const query = (u.searchParams.get('q') || '').slice(0, 200);
      return {kind:'explore', query, category:({'/food':'Food','/drinks':'Drinks','/events':'Events','/free':'Free','/freebies':'Free','/kids':'Family','/family':'Family','/beauty':'Beauty','/hair':'Beauty','/experiences':'Experiences','/activities':'Experiences','/golf':'Experiences','/tourism':'Experiences'})[path] || 'All', when:({'/now':'now','/today':'now','/tonight':'tonight','/weekend':'weekend'})[path] || 'any'};
    }
    if (/^\/(deals|venues|places)\/[^/]+$/.test(path)) {
      const segment = decodeURIComponent(path.slice(path.lastIndexOf('/') + 1));
      if (!segment || /[\u0000-\u001f\/\\]/.test(segment)) return null;
      // Public detail pages do not need private tokens, device identifiers or fragments.
      return {kind:'page', url:SITE + path};
    }
  } catch { /* Invalid URLs are never forwarded to the native host. */ }
  return null;
}
export function readNativeNavigationMessage(data, documentUrl) {
  const mode = nativeShellMode(documentUrl, true);
  if (typeof data !== 'string' || data.length > 8192 || !mode || (mode === 'sheet' && nativeNavigation(documentUrl)?.kind !== 'page')) return null;
  try {
    const message = JSON.parse(data);
    if (message?.type === 'perkdrop:save' && typeof message.id === 'string' && /^[a-z0-9_:.-]{1,240}$/i.test(message.id)) return {kind:'save', id:message.id};
    if (message?.type !== 'perkdrop:navigate') return null;
    if (mode !== 'map') return null;
    return nativeNavigation(message.url);
  } catch { return null; }
}
export function nativeSavedIds(value) {
  return Array.isArray(value) ? [...new Set(value.filter(id => typeof id === 'string' && /^[a-z0-9_:.-]{1,240}$/i.test(id)))].slice(0, 500) : [];
}
export function nativeSavedScript(value) {
  return 'window.PerkDropNativeSaved=' + JSON.stringify(nativeSavedIds(value)) + ';window.dispatchEvent(new Event("perkdrop:native-saved"));true;';
}
