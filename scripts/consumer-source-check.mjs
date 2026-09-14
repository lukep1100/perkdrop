// Read-only evidence collector. Never turns extracted coordinates into automatic repairs.
import fs from 'node:fs/promises';
const root = '.audit/consumer';
const offers = JSON.parse(await fs.readFile(`${root}/offers.json`, 'utf8'));
const businesses = JSON.parse(await fs.readFile(`${root}/businesses.json`, 'utf8'));
const urls = [...new Set([...offers.map(x=>x.source),...businesses.filter(x=>x.latitude==null||x.longitude==null).map(x=>x.website_url)].filter(Boolean))];
const results = []; let next=0;
async function worker(){while(next<urls.length){const url=urls[next++];try{
 const res=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{'User-Agent':'PerkDrop listing verification (perkdrop.au)'}});
 const html=await res.text();
 const text=html.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
 const geo=[...html.matchAll(/.{0,100}(?:"latitude"|"longitude"|!3d-\d|!2d1\d|@-\d|ll=-\d|q=-\d|maps[^"<> ]{0,100}).{0,150}/gi)].slice(0,30).map(x=>x[0].replace(/([?&](?:amp;)?key=)[^&"'<>\s]+/gi,'$1[redacted]'));
 results.push({url,finalUrl:res.url,status:res.status,checkedAt:new Date().toISOString(),text:text.slice(0,65000),geo});
}catch(e){results.push({url,error:String(e.message)});}}}
await Promise.all(Array.from({length:5},worker));
await fs.writeFile(`${root}/source-checks.json`,JSON.stringify(results,null,2));
console.log(JSON.stringify({urls:urls.length,ok:results.filter(x=>x.status===200).length,geoCandidatePages:results.filter(x=>x.geo?.length).length},null,2));
