const base=(process.env.SMOKE_BASE_URL||'http://localhost:3000').replace(/\/$/,'');
const catalogueUrl='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=1';
const routes=['/','/food','/map','/business','/terms','/privacy','/merchant-terms','/drop-terms','/verification','/affiliate','/contact','/claim','/admin','/api/health'];

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

const results=await Promise.all([...routes,liveDealRoute].map(async route=>{
 try{const response=await fetch(base+route,{redirect:'manual'});return {route,status:response.status};}
 catch{return {route,status:0};}
}));
const bad=results.filter(result=>result.status<200||result.status>=400);
for(const result of results)console.log(`${result.status} ${result.route}`);
if(bad.length)process.exitCode=1;
