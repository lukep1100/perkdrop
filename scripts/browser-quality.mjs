import {execFileSync} from 'node:child_process';
import {mkdir,writeFile,copyFile} from 'node:fs/promises';
import path from 'node:path';
const binary=process.env.AGENT_BROWSER_BIN||'agent-browser';
const base=process.env.BROWSER_BASE_URL||'http://localhost:3100';
const session='perkdrop-audit',route=process.argv[2]||'/';
const folder=path.resolve('.audit/browser-quality/'+new URL(base).hostname);
await mkdir(folder,{recursive:true});
function run(args){const raw=execFileSync(binary,['--session',session,'--json',...args],{encoding:'utf8',windowsHide:true,timeout:40000});const out=JSON.parse(raw);if(!out.success)throw Error(JSON.stringify(out.error));return out.data;}
run(['open',base+route]);
run(['wait',route.startsWith('/claim?merchant=')?'#change-business':route.startsWith('/claim')?'#business-search':route==='/map'?'.venue-card':route.startsWith('/tonight')?'#availability-filter':route.startsWith('/report')?'#report-form':route.startsWith('/venues/')?'a[href*="/claim?merchant="]':route.startsWith('/deals/')?'main':'.deal-card']);
const results=[];
for(const width of [320,360,375,390,412,430,768,1280]) {
  run(['set','viewport',String(width),width>=768?'900':'844']);
  const data=run(['eval',`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,h1:document.querySelector('h1')?.textContent,font:getComputedStyle(document.body).fontFamily,lang:document.documentElement.lang,zoomBlocked:(document.querySelector('meta[name="viewport"]')?.content||'').includes('user-scalable=no'),overlay:!!document.querySelector('[data-nextjs-dialog]'),buttons:[...document.querySelectorAll('button')].filter(x=>x.getBoundingClientRect().width>0).map(x=>({text:(x.getAttribute('aria-label')||x.textContent).trim().slice(0,60),height:Math.round(x.getBoundingClientRect().height),width:Math.round(x.getBoundingClientRect().width)})),pins:document.querySelectorAll('.leaflet-marker-icon').length,businessCards:document.querySelectorAll('.venue-card').length,dealCards:document.querySelectorAll('.deal-card').length,firstCardTop:Math.round(document.querySelector('.deal-card')?.getBoundingClientRect().top||0)})`]);
  results.push(data.result??data);
  const result=data.result??data;
  console.log(JSON.stringify({route,width,overflow:result.scrollWidth-result.width,lang:result.lang,pins:result.pins,dealCards:result.dealCards,businessCards:result.businessCards,undersizedButtons:result.buttons.filter(b=>b.height<44||b.width<44).length}));
  if([320,390,1280].includes(width)){const shot=run(['screenshot']);const location=shot.path||shot.screenshotPath||shot.screenshot;if(typeof location==='string')await copyFile(location,path.join(folder,route.replace(/[^a-z0-9]/gi,'_')+'-'+width+'.png'));else console.log('SCREENSHOT '+JSON.stringify(shot));}
}
await writeFile(path.join(folder,route.replace(/[^a-z0-9]/gi,'_')+'.json'),JSON.stringify({base,route,checkedAt:new Date().toISOString(),results},null,2));
if(results.some(x=>x.scrollWidth>x.width||x.overlay||x.zoomBlocked))process.exitCode=1;
