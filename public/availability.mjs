// Explicit, reviewed service windows only. Never parse marketing copy into availability.
export const ZONES = {SA:'Australia/Adelaide',NT:'Australia/Darwin',WA:'Australia/Perth',QLD:'Australia/Brisbane',NSW:'Australia/Sydney',ACT:'Australia/Sydney',VIC:'Australia/Melbourne',TAS:'Australia/Hobart'};
export function localClock(state, now=new Date()) {
  if (!ZONES[state] || !Number.isFinite(now.getTime())) return null;
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:ZONES[state],year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now).map(x=>[x.type,x.value]));
  return {date:`${p.year}-${p.month}-${p.day}`,minutes:Number(p.hour)*60+Number(p.minute),zone:ZONES[state]};
}
const dayNumber=date=>new Date(`${date}T12:00:00Z`).getUTCDay()||7;
const addDays=(date,n)=>new Date(Date.parse(`${date}T12:00:00Z`)+n*86400000).toISOString().slice(0,10);
const minutes=t=>typeof t==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(t)?Number(t.slice(0,2))*60+Number(t.slice(3)):NaN;
export function freshness(deal,now=new Date()) {
  const a=deal.availability||{}, checked=Date.parse(a.checkedAt||deal.lastVerifiedAt||'');
  if(a.reviewState==='conflicting')return {state:'conflicting',label:'Details conflict — check with venue'};
  if(!Number.isFinite(checked)||checked>now.getTime())return {state:'unknown',label:'Not recently checked'};
  const date=new Intl.DateTimeFormat('en-AU',{day:'numeric',month:'short',year:'numeric',timeZone:ZONES[deal.state]||'Australia/Sydney'}).format(new Date(checked));
  return {state:now-checked>30*86400000?'stale':'recent',label:`${now-checked>30*86400000?'Needs recheck · last checked':'Source checked'} ${date}`};
}
export function serviceWindows(deal,date,now=new Date()) {
  const a=deal.availability||{}, clock=localClock(deal.state,now);
  if(!clock||a.reviewState!=='checked'||!a.sourceUrl||freshness(deal,now).state!=='recent'||(!a.validUntil&&a.recurrence!=='ongoing')||a.validUntil&&date>a.validUntil||a.validFrom&&date<a.validFrom||deal.end&&date>deal.end||(a.excludedDates||[]).includes(date)||deal.qualityGrade==='D')return [];
  return (Array.isArray(a.windows)?a.windows:[]).filter(w=>{
    const start=minutes(w.start),end=minutes(w.end);
    return Number.isFinite(start)&&Number.isFinite(end)&&end>start&&(w.dates?w.dates.includes(date):Array.isArray(w.days)&&w.days.includes(dayNumber(date)));
  });
}
export function availabilityMatches(deal,mode='tonight',now=new Date()) {
  const clock=localClock(deal.state,now);if(!clock)return false;
  // Bookable inventory must refer to this service date, not the next available session.
  const capacityFor=date=>!deal.merchantOfferId||(deal.offerServiceDate===date&&Number(deal.capacityRemaining)>0);
  let dates=[clock.date];
  if(mode==='week')dates=Array.from({length:7},(_,i)=>addDays(clock.date,i));
  if(mode==='weekend'){const day=dayNumber(clock.date),sat=day===7?clock.date:addDays(clock.date,(6-day+7)%7);dates=day===7?[sat]:[sat,addDays(sat,1)];}
  if(/^day-[1-7]$/.test(mode))dates=[addDays(clock.date,(Number(mode.slice(4))-dayNumber(clock.date)+7)%7)];
  return dates.some(date=>capacityFor(date)&&serviceWindows(deal,date,now).some(w=>{
    const start=minutes(w.start),end=minutes(w.end),remaining=date===clock.date?clock.minutes:0;
    if(mode==='now')return start<=remaining&&end>remaining;
    return end>Math.max(remaining,mode==='tonight'?17*60:0);
  }));
}
export function scheduleLabel(deal) {
  const a=deal.availability||{};
  if(a.label)return a.label;
  return deal.timing||'Days and service times not confirmed';
}

// Selected-time explanations use the same reviewed windows as Now/Tonight.
// Future eligibility describes a recorded schedule, not guaranteed live inventory.
export function selectedAvailability(deal,{date,time,insideArea=true,dinnerEligible=true}={},now=new Date()) {
  const a=deal.availability||{},at=minutes(time),clock=localClock(deal.state,now),selectedStamp=Date.parse(`${date}T12:00:00Z`);
  const result=reason=>({eligible:reason==='available',reason,date,time});
  if(deal.publicVisible===false||deal.active===false)return result('business_excluded');
  if(!insideArea)return result('outside_area');
  if(!dinnerEligible)return result('not_dinner');
  if(!clock||!/^\d{4}-\d{2}-\d{2}$/.test(date||'')||!Number.isFinite(selectedStamp)||new Date(selectedStamp).toISOString().slice(0,10)!==date||!Number.isFinite(at)||at>=1440)return result('invalid_selection');
  if((deal.end&&date>deal.end)||(a.validUntil&&date>a.validUntil))return result('expired');
  if(a.reviewState==='conflicting')return result('source_conflict');
  if(a.validFrom&&date<a.validFrom)return result('not_started');
  if((a.excludedDates||[]).includes(date))return result('excluded_date');
  if(freshness(deal,now).state!=='recent'||!a.sourceUrl)return result('freshness_insufficient');
  if(deal.bookingEvidence==='unresolved')return result('booking_unresolved');
  const valid=(a.windows||[]).filter(w=>Number.isFinite(minutes(w.start))&&minutes(w.end)>minutes(w.start));
  if(!valid.length)return result('service_hours_unknown');
  const windows=serviceWindows(deal,date,now);
  if(a.reviewState!=='checked'||deal.qualityGrade==='D'||(!a.validUntil&&a.recurrence!=='ongoing'))return result('freshness_insufficient');
  if(!windows.length)return result('wrong_weekday');
  if(windows.some(w=>minutes(w.start)<=at&&at<minutes(w.end))){
    if(deal.merchantOfferId&&(deal.offerServiceDate!==date||!(Number(deal.capacityRemaining)>0)))return result('booking_unresolved');
    return result('available');
  }
  return result(windows.some(w=>minutes(w.start)>at)?'starts_later':'service_finished');
}
