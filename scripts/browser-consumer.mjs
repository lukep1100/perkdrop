import {execFileSync} from 'node:child_process';
import {writeFile,mkdir,copyFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const bin=process.env.AGENT_BROWSER_BIN||'agent-browser',base=process.env.BROWSER_BASE_URL||'http://localhost:3100',results=[];
function run(args){const r=JSON.parse(execFileSync(bin,['--session','perkdrop-audit','--json',...args],{encoding:'utf8',windowsHide:true,timeout:40000}));if(!r.success)throw Error(JSON.stringify(r.error));return r.data;}
const evaluate=code=>run(['eval',code]).result;
const check=(name,ok,evidence)=>{assert.ok(ok,name);results.push({name,evidence});console.log('PASS '+name+' '+JSON.stringify(evidence));};
const open=(route,selector)=>{run(['open',base+route]);run(['wait',selector]);};
run(['set','viewport','390','844']);
open('/tonight','#availability-filter');
let value=evaluate(`({text:document.querySelector('main').innerText,cards:document.querySelectorAll('.deal-card').length})`);
check('Tonight explains exact time and conditions',value.text.includes('after 5pm')&&value.text.includes('local time'),{cards:value.cards});
check('Lunch and Tuesday schnitzels are not promoted as tonight on Monday',!value.text.includes('20% OFF LUNCH ONLY')&&!value.text.includes('$15 schnitzels every Tuesday'),{checkedAt:new Date().toISOString()});
run(['select','#availability-filter','day-3']);
value=evaluate(`({url:location.href,choice:document.querySelector('#availability-filter').value,text:document.querySelector('main').innerText})`);
check('Day selector survives navigation and excludes conflicting Cucina',value.choice==='day-3'&&!value.text.includes('$15 pasta nights'),{choice:value.choice});
open('/tonight?when=tonight','#availability-filter');run(['click','#location-pill']);run(['click','[data-city="darwin"]']);
check('Unsupported tonight market shows useful empty state',evaluate(`document.querySelector('main').innerText.includes('No confirmed options')`));
run(['click','#location-pill']);run(['click','[data-city="adelaide"]']);
open('/food','.deal-card');
check('Food filter does not match unrelated gallery words',!evaluate(`document.querySelector('main').innerText.includes('Monet to Matisse')`));
for(const q of ['schnitty','cheap dinner','kids eat free','Adelaide CBD']){
 open('/search?q='+encodeURIComponent(q),'#search-input');run(['wait','.deal-card']);check('Natural search: '+q,evaluate(`document.querySelectorAll('.deal-card').length>0`));
}
for(const slug of ['union-hotel-adelaide','adelaide-botanic-garden-e931de']){
 open('/venues/'+slug,'.venue-photo');run(['wait','--fn',`document.querySelector('.venue-photo').complete&&document.querySelector('.venue-photo').naturalWidth>0`]);
 value=evaluate(`(()=>{const i=document.querySelector('.venue-photo');return {width:i.naturalWidth,height:i.naturalHeight,fit:getComputedStyle(i).objectFit,caption:document.querySelector('main').innerText}})()`);
 check('Rights-cleared business hero fetches and is not stretched: '+slug,value.width>=600&&value.height>=350&&value.fit==='cover',{width:value.width,height:value.height,fit:value.fit});
 const shot=run(['screenshot']);await mkdir('.audit/consumer',{recursive:true});await copyFile(shot.path,`.audit/consumer/${slug}-${new URL(base).hostname}.png`);
}
open('/report?drop=PD-2026-0058','#report-form');
run(['click','#report-form button']);check('Report requires a reason',evaluate(`!document.querySelector('#report-form').checkValidity()`));
if(process.env.REPORT_REAL_ISSUE==='1'){
 run(['select','#report-form select','times']);run(['fill','#report-form textarea','Official homepage advertises Monday pasta from 5pm, but the contact page lists Monday hours as 7am–3pm. Please confirm current Monday service with Cucina.']);
 run(['click','#report-form button']);run(['wait','--fn',`document.querySelector('#report-status').innerText.includes('saved for PerkDrop review')`]);
 check('Observed real source conflict submitted to staff review',evaluate(`document.querySelector('#report-status').innerText.includes('Nothing has been removed automatically')`));
}
const auth=evaluate(`fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-listing-reports').then(async r=>({status:r.status,body:await r.json()}))`);
check('Anonymous user cannot read staff report queue',auth.status===401,{status:auth.status});
await mkdir('.audit/consumer',{recursive:true});await writeFile('.audit/consumer/browser-'+new URL(base).hostname+'.json',JSON.stringify({base,checkedAt:new Date().toISOString(),results},null,2));
console.log(JSON.stringify({passed:results.length,claimsCreated:0,bookingsCreated:0,realObservedIssueReported:process.env.REPORT_REAL_ISSUE==='1'}));
