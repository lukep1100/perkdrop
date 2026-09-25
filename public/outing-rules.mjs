import {dateMatches,serviceWindows,localClock,addDays,ZONES} from './availability.mjs';
import {isUnconditionallyFree,validCoordinates} from './discovery-rules.mjs';
export function distanceKm(a,b){if(!validCoordinates(a.latitude,a.longitude)||!validCoordinates(b.latitude,b.longitude))return null;const r=Math.PI/180,x=Math.sin((b.latitude-a.latitude)*r/2)**2+Math.cos(a.latitude*r)*Math.cos(b.latitude*r)*Math.sin((b.longitude-a.longitude)*r/2)**2;return 12742*Math.asin(Math.min(1,Math.sqrt(x)));}
export function groupCost(d,{adults=1,ages=[]}={}){
  const p=d.pricing; if(isUnconditionallyFree(d))return {known:true,total:0,label:'Free entry · extras may cost more'};
  if(!p||p.currency!=='AUD'||p.verified!==true)return {known:false,total:null,label:d.price||'Price to confirm'};
  const n=Number(adults);if(!Number.isInteger(n)||n<0||!Array.isArray(ages))return {known:false,total:null,label:'Choose your group'};
  if(p.basis==='person'&&Number.isFinite(p.amount)&&p.amount>=0)return {known:true,total:p.amount*(n+ages.length),label:`$${(p.amount*(n+ages.length)).toFixed(2)} for your group${p.feesIncluded?'':' + any booking fees'}`};
  if(p.basis==='age_bands'&&Number.isFinite(p.adult)&&p.adult>=0){let total=n*p.adult;for(const age of ages){const band=p.children?.find(b=>age>=b.min&&age<=b.max&&Number.isFinite(b.amount)&&b.amount>=0);if(!band)return {known:false,total:null,label:'Child price to confirm'};total+=band.amount;}return {known:true,total,label:`$${total.toFixed(2)} for your group${p.feesIncluded?'':' + any booking fees'}`};}
  return {known:false,total:null,label:d.price||'Price to confirm'};
}
export function matchesOuting(d,f={},now=new Date()){
 if(f.date&&!dateMatches(d,f.date,now))return false;
 const ages=Array.isArray(f.ages)?f.ages:[],info=d.suitability||{};
 if(ages.length&&!(info.verified===true&&ages.every(age=>(info.allAges===true||Number.isFinite(info.minAge)&&Number.isFinite(info.maxAge)&&age>=info.minAge&&age<=info.maxAge))))return false;
 if(f.setting&&(!info.verified||info.setting!==f.setting))return false;
 if(f.accessible&&(!info.verified||info.wheelchair!==true))return false;
 if(f.budget!==''&&f.budget!=null){const cost=groupCost(d,f);if(!cost.known||cost.total>Number(f.budget))return false;}
 return true;
}
export function suggestedDate(d,now=new Date()){
 const today=localClock(d.timezone||ZONES[d.state],now)?.date;if(!today)return '';
 for(let i=0;i<90;i++){const date=addDays(today,i);if(dateMatches(d,date,now))return date;}return '';
}
export function planSummary(items,date,group={},now=new Date()){
 const costs=items.map(d=>groupCost(d,group)),known=costs.reduce((s,c)=>s+(c.total||0),0),unknown=costs.filter(c=>!c.known).length;
 const legs=items.slice(1).map((d,i)=>distanceKm(items[i],d));
 return {knownCost:known,unknownPrices:unknown,distanceKm:legs.every(k=>k!==null)?legs.reduce((s,k)=>s+k,0):null,items:items.map((d,i)=>({id:d.id,cost:costs[i],schedule:!date?'Choose a date':!dateMatches(d,date,now)?'No confirmed session on this date':serviceWindows(d,date,now).length?serviceWindows(d,date,now).map(w=>`${w.start}–${w.end}`).join(', '):'Date confirmed · daily hours to check'}))};
}
const icsEscape=v=>String(v||'').replace(/\\/g,'\\\\').replace(/\r?\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');
export function planCalendar(plan,now=new Date()){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(plan.planned_for||''))throw Error('Choose a date first');
 const lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//PerkDrop//Plans//EN','BEGIN:VEVENT',`UID:${icsEscape(plan.id)}@perkdrop.au`,`DTSTAMP:${now.toISOString().replace(/[-:]/g,'').replace(/\.\d+Z/,'Z')}`,`DTSTART;VALUE=DATE:${plan.planned_for.replace(/-/g,'')}`,`DTEND;VALUE=DATE:${addDays(plan.planned_for,1).replace(/-/g,'')}`,`SUMMARY:${icsEscape(plan.name)}`,`DESCRIPTION:${icsEscape([plan.note,'Check current times and book with each venue. This plan is not a reservation.',...plan.items.map(d=>`${d.merchant} — ${d.title}\nhttps://perkdrop.au${d.href||'/deals/'+encodeURIComponent(d.slug||d.id)}`)].join('\n\n'))}`,'BEGIN:VALARM','ACTION:DISPLAY','TRIGGER:-PT12H','DESCRIPTION:Check your PerkDrop plan','END:VALARM','END:VEVENT','END:VCALENDAR'];
 // Fold by UTF-8 octets so non-ASCII event names remain valid calendar content.
 return lines.map(line=>{let out='',part='',bytes=0;for(const c of line){const n=new TextEncoder().encode(c).length;if(bytes+n>73){out+=part+'\r\n ';part='';bytes=1;}part+=c;bytes+=n;}return out+part;}).join('\r\n')+'\r\n';
}
