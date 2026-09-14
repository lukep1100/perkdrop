import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const bin=process.env.AGENT_BROWSER_BIN||'agent-browser',results=[];
const run=args=>{const r=JSON.parse(execFileSync(bin,['--session','perkdrop-claim-qa','--json',...args],{encoding:'utf8',windowsHide:true,timeout:30000}));if(!r.success)throw Error(JSON.stringify(r.error));return r.data;};
const evaluate=js=>run(['eval',js]).result;
const check=(name,result)=>{assert.ok(result,name);results.push({name,passed:true});console.log('ISOLATED UI PASS: '+name);};
run(['set','viewport','390','844']);
for(const phase of ['pending','approved','recovery','expired','admin']){
 run(['open',`http://127.0.0.1:4199/claim?merchant=isolated-fixture&phase=${phase}${phase==='expired'?'#error=access_denied&error_code=otp_expired':''}`]);
 run(['wait',phase==='expired'?'#auth:not(.hidden)':'#claim-receipt:not(.hidden)']);
 check(phase+' mobile has no horizontal overflow',evaluate('document.documentElement.scrollWidth<=innerWidth'));
 if(phase==='pending'){
  check('pending receipt explains evidence review and no payment',evaluate('document.querySelector("#claim-receipt").innerText.includes("No offer or payment is required")'));
  check('pending claim cannot accidentally submit again',evaluate('document.querySelector("#claim").classList.contains("hidden")'));
  run(['reload']);run(['wait','#claim-receipt:not(.hidden)']);check('pending status survives reload',evaluate('document.querySelector("#claim-receipt").innerText.includes("Awaiting authority review")'));
 }
 if(phase==='approved'){
  check('approved fixture begins with useful owner actions',evaluate('document.querySelector("#owner-start").innerText.includes("Review listing / photos")'));
  run(['click','[data-owner-open="listing"]']);check('review listing opens its existing section',evaluate('document.querySelector("#owner-listing").open'));
 }
 if(phase==='recovery')check('recovery session exposes reset form',evaluate('!document.querySelector("#reset-password-card").classList.contains("hidden")'));
 if(phase==='expired')check('expired or reused link has actionable guidance',evaluate('document.querySelector("#msg").innerText.includes("expired")&&document.querySelector("#msg").innerText.includes("resend")'));
 if(phase==='admin'){run(['wait','#admin-notifications']);check('approval states distinguish queue, acceptance, legacy sent and unknown outcome',evaluate('(()=>{const t=document.querySelector("#admin-notifications").innerText;return t.includes("Provider accepted — delivery unconfirmed")&&t.includes("Legacy sent — delivery unconfirmed")&&t.includes("reconcile before retry")&&t.includes("Queued — not delivered")})()'));run(['screenshot']);}
 check(phase+' fixture made no mutation requests',evaluate('window.__qaOutbound.every(x=>x.method==="GET")'));
}
await writeFile('.audit/claim-ui-result.json',JSON.stringify({testedAt:new Date().toISOString(),environment:'loopback-only mocked transport; actual changed portal HTML',results,realOwner:false},null,2));
console.log(`${results.length} isolated UI checks; not a real owner completion.`);
