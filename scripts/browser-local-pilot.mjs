import {execFileSync} from 'node:child_process';
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bin=process.env.AGENT_BROWSER_BIN||'agent-browser',base=process.env.BROWSER_BASE_URL||'http://localhost:3100',results=[];
const api='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/';
const run=args=>{const r=JSON.parse(execFileSync(bin,['--session','perkdrop-audit','--json',...args],{encoding:'utf8',windowsHide:true,timeout:40000}));if(!r.success)throw Error(JSON.stringify(r.error));return r.data;};
const evaluate=js=>run(['eval',js]).result;
const check=(name,ok,evidence)=>{assert.ok(ok,name);results.push({name,evidence});console.log('PASS '+name);};
const open=(route,selector)=>{run(['open',base+route]);run(['wait',selector]);};
await mkdir('.audit/pilot-browser',{recursive:true});
run(['set','viewport','390','844']);
open('/tonight?when=selected&date=2026-09-15&time=18%3A00','#selected-time-form');
check('selected date and time retained',evaluate('document.querySelector("#selected-date").value==="2026-09-15"&&document.querySelector("#selected-time").value==="18:00"'));
check('future schedule qualification visible',evaluate('document.querySelector("main").innerText.includes("currently recorded schedule")'));
check('selected-time mobile has no overflow',evaluate('document.documentElement.scrollWidth<=innerWidth'));
open('/unsubscribe?token=00000000-0000-4000-8000-000000000999','form');
check('unsubscribe GET is confirmation only',evaluate('document.querySelector("form").method==="post"&&document.body.innerText.includes("Confirm unsubscribe")'));
check('unsubscribe has no external assets or scripts',evaluate('document.querySelectorAll("script,img,iframe,link[rel=stylesheet]").length===0'));
const plan=JSON.parse(await readFile('docs/data/local-pilot-changes-2026-09-14.json','utf8'));
const {deals}=await (await fetch(api+'perkdrop-catalogue-api?limit=500')).json();
const ids=[...new Set([...plan.photos.flatMap(x=>x.offerIds),...plan.newOffers.map(x=>x.id),...deals.filter(d=>d.state==='SA'&&d.city==='adelaide').map(d=>d.id),plan.repairWoodville.id,'PD-2026-0062','UNION-HOTEL-LUNCH-20-OFF'])].filter(id=>process.env.PRIORITY_BUSINESSES_ONLY!=='1'||['PD-2026-0059','PD-2026-0062','UNION-HOTEL-LUNCH-20-OFF',...plan.newOffers.map(x=>x.id)].includes(id));
for(const id of ids){
 const d=deals.find(x=>x.id===id);check('pilot offer exists: '+id,!!d);
 open('/search?q='+encodeURIComponent(d.merchant),'#search-input');
 run(['wait',`.card-link[href="/deals/${d.slug}"]`]);
 check('search card links to canonical offer: '+id,evaluate(`!!document.querySelector('.card-link[href="/deals/${d.slug}"]')`));
 run(['click',`.card-link[href="/deals/${d.slug}"] h3`]);run(['wait',id==='UNION-HOTEL-LUNCH-20-OFF'?'#startBtn':'.detail-hero img']);
 check('offer mobile has no overflow: '+id,evaluate('document.documentElement.scrollWidth<=innerWidth'));
 if(id==='UNION-HOTEL-LUNCH-20-OFF'){check('Union remains booking-first; no hold created',evaluate('!!document.querySelector("#startBtn")'));continue;}
 run(['wait','--fn','document.querySelector(".detail-hero img").complete&&document.querySelector(".detail-hero img").naturalWidth>0']);
 const image=evaluate('(()=>{const i=document.querySelector(".detail-hero img");return {url:i.currentSrc,width:i.naturalWidth,height:i.naturalHeight,fit:getComputedStyle(i).objectFit,alt:i.alt}})()');
 check('offer image or labelled fallback decodes: '+id,image.width>0&&image.alt.length>0,image);
 if(plan.photoHoldIds.includes(id))check('unlicensed or wrong-branch photo is replaced by labelled fallback: '+id,image.url.includes('venue-unavailable.svg')&&image.alt==='Photo unavailable');
 if(d.latitude!=null&&d.longitude!=null){run(['wait','#detail-map .leaflet-marker-icon']);check('offer map has a destination pin: '+id,evaluate('document.querySelectorAll("#detail-map .leaflet-marker-icon").length>0'));}
 if(plan.newOffers.some(x=>x.id===id))check('supplied poster is not cropped: '+id,image.fit==='contain');
 if(d.merchantSlug){
  const profile='/venues/'+d.merchantSlug;check('detail links to same business profile: '+id,evaluate(`!!document.querySelector('a[href="${profile}"]')`));
  open(profile,'.hero-actions');check('business profile names the offer merchant: '+id,evaluate(`document.querySelector('main').innerText.includes(${JSON.stringify(d.merchant)})`));
  if(plan.photos.some(p=>p.merchantId===d.merchantId)){run(['wait','--fn','document.querySelector(".venue-photo")?.complete&&document.querySelector(".venue-photo").naturalWidth>0']);const hero=evaluate('(()=>{const i=document.querySelector(".venue-photo");return {width:i.naturalWidth,displayWidth:i.getBoundingClientRect().width,fit:getComputedStyle(i).objectFit}})()');check('rights-cleared directory hero decodes without upscaling: '+id,hero.width>=226&&hero.displayWidth<=hero.width+1,hero);}
 }
 const navigation=await fetch(d.navigationUrl,{redirect:'manual'}),target=new URL(navigation.headers.get('location')||'https://invalid.example');check('directions reaches canonical destination without booking: '+id,navigation.status===302&&target.hostname==='www.google.com'&&target.searchParams.get('destination')===(d.latitude!=null&&d.longitude!=null?`${d.latitude},${d.longitude}`:d.location||d.merchant),{status:navigation.status,location:target.href});
 if(plan.newOffers.some(x=>x.id===id)||id==='PD-2026-0008'||id==='PD-2026-0009'){
  open('/deals/'+d.slug,'.detail-hero img');const shot=run(['screenshot']);await copyFile(shot.path,`.audit/pilot-browser/${id}-${new URL(base).hostname}.png`);
 }
}
if(process.env.PRIORITY_BUSINESSES_ONLY==='1'){
 open('/claim?merchant=union-hotel-adelaide','#selected-business:not(.hidden)');
 check('live claim preselects exact Union branch',evaluate('document.querySelector("#selected-business").innerText.includes("70 Waymouth St")'));
 check('live claim mobile has no overflow',evaluate('document.documentElement.scrollWidth<=innerWidth'));
 check('live claim keeps verification and recovery controls',evaluate('!!document.querySelector("#resend-verification")&&!!document.querySelector("#forgot-password")&&document.body.innerText.includes("verified email is required")'));
 const claimShot=run(['screenshot']);await copyFile(claimShot.path,`.audit/pilot-browser/claim-${new URL(base).hostname}.png`);
 open('/deals/union-hotel-20-off-lunch?utm_source=codex_qa&utm_medium=test&utm_campaign=onboarding_release','#startBtn');
 check('Union campaign query tracking survives page load',evaluate('new URL(location.href).searchParams.get("utm_campaign")==="onboarding_release"'));
 check('Union purchase and lunch-only conditions remain visible',evaluate('document.body.innerText.includes("drink")&&/lunch/i.test(document.body.innerText)'));
 for(const slug of ['ready-team-one','brownsmart-829acb87bf'])check('excluded business remains publicly delisted: '+slug,(await fetch(base+'/venues/'+slug)).status===404);
}
await writeFile(`.audit/pilot-browser/${new URL(base).hostname}.json`,JSON.stringify({base,testedAt:new Date().toISOString(),results,bookingsCreated:0,claimsCreated:0,messagesSent:0},null,2));
console.log(JSON.stringify({passed:results.length,bookingsCreated:0,claimsCreated:0,messagesSent:0}));
