const VERSION='v25-multi-vertical';
const CACHE=`perkdrop-${VERSION}`;
const STATIC=['/','/app.js?v=v25-multi-vertical','/styles.css?v=v25-multi-vertical','/icon.svg','/manifest.webmanifest'];
const ROUTES=['/','/food','/drinks','/events','/beauty','/experiences','/activities','/stay','/last-minute','/free','/kids','/shopping','/weekend','/ending-soon','/near-me','/map','/business','/about','/terms','/privacy','/merchant-terms','/drop-terms','/verification','/affiliate','/contact'];
const never=p=>p==='/admin'||p==='/claim'||p==='/merchant-floor'||p.startsWith('/deals/')||p.startsWith('/api/')||p.includes('perkdrop-catalogue-api');
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(STATIC)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('perkdrop-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;const u=new URL(e.request.url);if(u.origin!==location.origin||never(u.pathname))return;if(STATIC.includes(u.pathname+u.search)){e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)));return}if(ROUTES.includes(u.pathname)||u.pathname.startsWith('/deals/'))e.respondWith(fetch(e.request).then(r=>{if(r.ok)caches.open(CACHE).then(c=>c.put(e.request,r.clone()));return r}).catch(()=>caches.match(e.request).then(r=>r||caches.match('/'))))});

