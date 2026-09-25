// Shared by web and native. Structured evidence only; never infer hours from copy.
export const ZONES = {SA:'Australia/Adelaide',NT:'Australia/Darwin',WA:'Australia/Perth',QLD:'Australia/Brisbane',NSW:'Australia/Sydney',ACT:'Australia/Sydney',VIC:'Australia/Melbourne',TAS:'Australia/Hobart'};
export const addDays=(date,n)=>new Date(Date.parse(`${date}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const dayNumber=date=>new Date(`${date}T12:00:00Z`).getUTCDay()||7;
const minutes=t=>typeof t==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
const timeString=m=>`${String(Math.floor(m/60)).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
const zone=deal=>deal.timezone||deal.availability?.timezone||ZONES[deal.state];
export function localClock(state,now=new Date()) {
  const tz=ZONES[state]||Object.values(ZONES).find(z=>z===state);if(!tz||!Number.isFinite(now.getTime()))return null;
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute),zone:tz};
}
const blocked=d=>d.active===false||d.publicVisible===false||d.qualityGrade==='D'||['conflicting','cancelled','unverified','unknown'].includes(d.availability?.reviewState)||['cancelled','canceled','postponed'].includes(d.availability?.status);
export function freshness(deal,now=new Date()) {
  const a=deal.availability||{},checked=Date.parse(a.checkedAt||a.checked_at||deal.scheduleVerifiedAt||deal.lastVerifiedAt||'');
  if(a.reviewState==='conflicting')return {state:'conflicting',label:'Details conflict — check with venue'};
  if(!Number.isFinite(checked)||checked>now.getTime())return {state:'unknown',label:'Not recently checked'};
  const date=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:zone(deal)||'Australia/Sydney'}).format(new Date(checked));
  return {state:now-checked>30*86400000?'stale':'recent',label:`${now-checked>30*86400000?'Needs recheck · last checked':'Source checked'} ${date}`};
}
const source=d=>d.availability?.sourceUrl||d.officialSource||d.source;
const recent=(stamp,now)=>Number.isFinite(Date.parse(stamp))&&Date.parse(stamp)<=+now&&+now-Date.parse(stamp)<=30*86400000;
function datedEvidence(d,now){return !blocked(d)&&/^https?:\/\//.test(source(d)||'')&&recent(d.scheduleVerifiedAt||d.availability?.checkedAt||d.availability?.checked_at,now);}
function dateAllowed(d,date){const a=d.availability||{};return !(a.validFrom&&date<a.validFrom||a.validUntil&&date>a.validUntil||d.end&&date>d.end||(a.excludedDates||[]).includes(date));}
function timestampWindows(d,date,now){
  if(!datedEvidence(d,now)||!dateAllowed(d,date))return [];
  const entries=Array.isArray(d.availability?.occurrences)?d.availability.occurrences:[{startsAt:d.startsAt,endsAt:d.endsAt}];
  return entries.flatMap(o=>{
    if(['cancelled','postponed'].includes(o.status))return [];
    const start=new Date(o.startsAt),end=new Date(o.endsAt),duration=end-start;
    // A long exhibition/festival envelope is a date range, not continuous hours.
    if(!(duration>0&&duration<=24*3600000))return [];
    const s=localClock(zone(d),start),e=localClock(zone(d),end);if(!s||!e||date<s.date||date>e.date)return [];
    const from=date===s.date?s.minutes:0,to=date===e.date?e.minutes:1440;
    return to>from?[{start:timeString(from),end:timeString(to),startsAt:start.toISOString(),endsAt:end.toISOString(),date}]:[];
  });
}
export function serviceWindows(deal,date,now=new Date()) {
  const a=deal.availability||{};
  if(!localClock(zone(deal),now)||blocked(deal)||!dateAllowed(deal,date))return [];
  const dated=timestampWindows(deal,date,now);
  if(a.reviewState!=='checked'||!a.sourceUrl||freshness(deal,now).state!=='recent'||(!a.validUntil&&a.recurrence!=='ongoing'))return dated;
  const matches=(w,on)=>w.dates?w.dates.includes(on):Array.isArray(w.days)&&w.days.includes(dayNumber(on));
  const windows=(Array.isArray(a.windows)?a.windows:[]).flatMap(w=>{
    const start=minutes(w.start),end=minutes(w.end),last=minutes(w.lastEntry);
    if(!Number.isFinite(start)||!Number.isFinite(end)||start===end)return [];
    if(end>start)return matches(w,date)?[{...w,end:Number.isFinite(last)?timeString(Math.min(last,end)):w.end}]:[];
    // Overnight service must be explicit, and exclusions apply to both local dates.
    if(w.overnight!==true)return [];
    const previous=addDays(date,-1),parts=[];
    if(matches(w,date))parts.push({...w,end:'24:00'});
    if(dateAllowed(deal,previous)&&matches(w,previous))parts.push({...w,start:'00:00'});
    return parts;
  });
  return [...windows,...dated];
}
export function datesForMode(mode,clock){
  if(mode==='week')return Array.from({length:7},(_,i)=>addDays(clock.date,i));
  if(mode==='weekend'){const day=dayNumber(clock.date),sat=day===7?clock.date:addDays(clock.date,(6-day+7)%7);return day===7?[sat]:[sat,addDays(sat,1)];}
  if(/^day-[1-7]$/.test(mode))return [addDays(clock.date,(Number(mode.slice(4))-dayNumber(clock.date)+7)%7)];
  if(/^\d{4}-\d{2}-\d{2}$/.test(mode))return [mode];
  return [clock.date];
}
export function dateMatches(deal,date,now=new Date()){
  if(blocked(deal)||!dateAllowed(deal,date))return false;
  if(serviceWindows(deal,date,now).length)return true;
  if(!datedEvidence(deal,now))return false;
  const s=localClock(zone(deal),new Date(deal.startsAt)),e=localClock(zone(deal),new Date(deal.endsAt));
  return Boolean(s&&e&&new Date(deal.endsAt)>new Date(deal.startsAt)&&s.date<=date&&e.date>=date&&!(e.date===date&&e.minutes===0));
}
export function availabilityMatches(deal,mode='tonight',now=new Date()) {
  const clock=localClock(zone(deal),now);if(!clock)return false;
  const capacityFor=date=>!deal.merchantOfferId||(deal.offerServiceDate===date&&Number(deal.capacityRemaining)>0);
  return datesForMode(mode,clock).some(date=>{
    if(!capacityFor(date))return false;
    const windows=serviceWindows(deal,date,now),remaining=date===clock.date?clock.minutes:0;
    if(windows.some(w=>mode==='now'?minutes(w.start)<=remaining&&minutes(w.end)>remaining:minutes(w.end)>Math.max(remaining,mode==='tonight'?17*60:0)))return true;
    // Date-only views may show a verified event envelope with hours still to check.
    return !['now','tonight'].includes(mode)&&!windows.length&&dateMatches(deal,date,now)&&!(deal.endsAt&&new Date(deal.endsAt)<=now);
  });
}
export function scheduleLabel(deal) {
  const a=deal.availability||{};
  if(a.label)return a.label;
  if(deal.startsAt&&deal.endsAt&&zone(deal)){
    const start=new Date(deal.startsAt),end=new Date(deal.endsAt);
    if(Number.isFinite(+start)&&Number.isFinite(+end)){
      const fmt=new Intl.DateTimeFormat('en-AU',{timeZone:zone(deal),weekday:'short',day:'numeric',month:'short'});
      const time=new Intl.DateTimeFormat('en-AU',{timeZone:zone(deal),hour:'numeric',minute:'2-digit'});
      return end-start<=86400000?`${fmt.format(start)} · ${time.format(start)}–${time.format(end)}`:`${fmt.format(start)}–${fmt.format(end)} · check daily hours`;
    }
  }
  return deal.timing||'Days and service times not confirmed';
}
export function selectedAvailability(deal,{date,time,insideArea=true,dinnerEligible=true}={},now=new Date()) {
  const a=deal.availability||{},at=minutes(time),clock=localClock(zone(deal),now),stamp=Date.parse(`${date}T12:00:00Z`),result=reason=>({eligible:reason==='available',reason,date,time});
  if(deal.publicVisible===false||deal.active===false)return result('business_excluded');
  if(!insideArea)return result('outside_area');if(!dinnerEligible)return result('not_dinner');
  if(!clock||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date||!Number.isFinite(at)||at>=1440)return result('invalid_selection');
  if((deal.end&&date>deal.end)||(a.validUntil&&date>a.validUntil))return result('expired');
  if(a.reviewState==='conflicting')return result('source_conflict');
  if(a.validFrom&&date<a.validFrom)return result('not_started');
  if((a.excludedDates||[]).includes(date))return result('excluded_date');
  if(freshness(deal,now).state!=='recent'||!source(deal)||blocked(deal))return result('freshness_insufficient');
  if(deal.bookingEvidence==='unresolved')return result('booking_unresolved');
  const windows=serviceWindows(deal,date,now);
  if(!windows.length){
    if(!a.windows?.length&&!deal.startsAt&&!a.occurrences?.length)return result('service_hours_unknown');
    if(a.windows?.length&&(a.reviewState!=='checked'||(!a.validUntil&&a.recurrence!=='ongoing')))return result('freshness_insufficient');
    return result(dateMatches(deal,date,now)?'service_hours_unknown':'wrong_weekday');
  }
  if(windows.some(w=>minutes(w.start)<=at&&at<minutes(w.end))){
    if(deal.merchantOfferId&&(deal.offerServiceDate!==date||!(Number(deal.capacityRemaining)>0)))return result('booking_unresolved');
    return result('available');
  }
  return result(windows.some(w=>minutes(w.start)>at)?'starts_later':'service_finished');
}
