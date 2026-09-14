const base=(process.env.SMOKE_BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const catalogueUrl='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=1';
const routes=['/','/food','/drinks','/events','/beauty','/experiences','/activities','/stay','/last-minute','/now','/my-perks','/free','/shopping','/map','/near-me','/about','/business','/terms','/privacy','/merchant-terms','/contact','/claim','/merchant-floor','/admin','/group','/api/health','/sitemap.xml','/robots.txt','/manifest.webmanifest','/sw.js','/deals/null','/deals/expired-shared-link','/deals/union-hotel-20-off-lunch?utm_source=meta&utm_medium=paid_social&utm_campaign=union_hotel_launch&fbclid=codex-smoke'];

let liveDealRoute='';
try{
 const response=await fetch(catalogueUrl,{headers:{accept:'application/json'}});
 const payload=await response.json();
 const deal=(Array.isArray(payload)?payload:payload.deals||[]).find(item=>item&&item.slug);
 if(deal)liveDealRoute=`/deals/${encodeURIComponent(deal.slug)}`;
}catch{}

if(!liveDealRoute){
 console.error('No live catalogue Drop was available for the smoke test.');
 process.exit(1);
}

const catalogueBase=catalogueUrl.split('?')[0];
const slugChecks=await Promise.all(['null','does-not-exist-xyz'].map(async slug=>{
 try{
  const response=await fetch(`${catalogueBase}?slug=${encodeURIComponent(slug)}`,{redirect:'manual'});
  return {slug,status:response.status,preflight:response.headers.get('x-perkdrop-slug-preflight')};
 }catch{return {slug,status:0,preflight:null};}
}));
for(const result of slugChecks)console.log(`${result.status} catalogue slug ${result.slug} (${result.preflight||'no preflight header'})`);
if(slugChecks.some(result=>result.status!==404||result.preflight!=='miss'))process.exitCode=1;

const results=await Promise.all([...routes,liveDealRoute].map(async route=>{
 try{const response=await fetch(base+route,{redirect:'manual'});return {route,status:response.status};}
 catch{return {route,status:0};}
}));
const missing=new Set(['/deals/null','/deals/expired-shared-link']);
const bad=results.filter(result=>missing.has(result.route)?result.status!==404:result.status<200||result.status>=400);
for(const result of results)console.log(`${result.status} ${result.route}`);
if(bad.length)process.exitCode=1;
