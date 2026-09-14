// Read-only analysis of a scoped exported snapshot; the public availability engine is reused.
import {readFile,writeFile} from 'node:fs/promises';
import {selectedAvailability,localClock} from '../public/availability.mjs';
const input=process.argv[2]||'docs/data/local-pilot-baseline-2026-09-14.json';
const output=process.argv[3]||'.audit/pilot-coverage-baseline.json';
const snapshot=JSON.parse(await readFile(input,'utf8')),now=new Date(snapshot.asOf||snapshot.capturedAt),first=localClock('SA',now).date;
if(!Number.isFinite(now.getTime()))throw Error('Snapshot needs a recorded timestamp');
const offers=snapshot.offers;
const dist=(lat,lng)=>{if(lat==null||lng==null)return Infinity;const r=Math.PI/180,x=Math.sin((Number(lat)+34.9285)*r/2)**2+Math.cos(-34.9285*r)*Math.cos(Number(lat)*r)*Math.sin((Number(lng)-138.6007)*r/2)**2;return 12742*Math.asin(Math.sqrt(x));};
const normal=s=>String(s||'').toLowerCase().replace(/[^a-z0-9]/g,'');
// Explicit reviewed meal classification, not category=food (which includes drinks).
const mealIds=new Set(['PD-2026-0056','PD-2026-0055','PD-2026-0059','PD-2026-0054','PD-2026-0058','UNION-HOTEL-LUNCH-20-OFF','PD-2026-0075','PD-2026-0062','UNION-PARMI-PINT','UNION-FRIDAY-STEAK']);
const rows=[];
for(let n=0;n<7;n++)for(const time of ['17:00','18:00','19:00','20:00']){
 const date=new Date(Date.parse(first+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
 const evaluated=offers.map(o=>{const decision=selectedAvailability({state:o.state,qualityGrade:o.quality_grade,availability:o.availability,end:o.end_date,lastVerifiedAt:o.last_verified_at,publicVisible:o.permanent_listing!==false&&o.directory_status!=='removed',active:o.active!==false,merchantOfferId:o.merchant_offer_id,offerServiceDate:o.offer_service_date,capacityRemaining:o.capacity_remaining},{date,time,insideArea:o.state==='SA'&&dist(o.latitude??o.business_latitude,o.longitude??o.business_longitude)<=12,dinnerEligible:mealIds.has(o.id)},now);return {id:o.id,business:o.merchant,businessKey:o.merchant_id||normal(o.merchant),eligible:decision.eligible,reason:decision.reason};});
 const eligible=evaluated.filter(x=>x.eligible),reasons={};for(const o of evaluated.filter(x=>!x.eligible))reasons[o.reason]=(reasons[o.reason]||0)+1;
 rows.push({date,time,businesses:new Set(eligible.map(x=>x.businessKey)).size,offers:eligible.length,eligible:eligible.map(({id,business})=>({id,business})),exclusions:reasons,excluded:evaluated.filter(x=>!x.eligible).map(({id,business,reason})=>({id,business,reason}))});
}
const result={asOf:now.toISOString(),area:'Adelaide inner metro: 12 km straight-line radius from Victoria Square (-34.9285, 138.6007)',scheduleBasis:'Currently recorded schedule, not future source or booking guarantee; existing 30-day evidence rule unchanged.',rows};
await writeFile(output,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(rows.map(({date,time,businesses,offers})=>({date,time,businesses,offers})),null,2));
