// Pure, deterministic production logic. Imported by Edge and Node tests.
export const VERTICALS=['food','events','beauty','wellness','experiences','activities','fitness','stay','shopping','free','other'];
export function distanceKm(a,b){
  if(![a?.latitude,a?.longitude,b?.latitude,b?.longitude].every(x=>typeof x==='number'&&Number.isFinite(x)))return null;
  const rad=x=>x*Math.PI/180,dlat=rad(b.latitude-a.latitude),dlon=rad(b.longitude-a.longitude);
  const h=Math.sin(dlat/2)**2+Math.cos(rad(a.latitude))*Math.cos(rad(b.latitude))*Math.sin(dlon/2)**2;
  return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));
}
export function localParts(date,timezone='Australia/Adelaide'){
  const parts=new Intl.DateTimeFormat('en-AU',{timeZone:timezone,hour:'numeric',weekday:'short',hourCycle:'h23'}).formatToParts(new Date(date));
  return {hour:Number(parts.find(x=>x.type==='hour').value),day:parts.find(x=>x.type==='weekday').value};
}
export function watchMatches(watch,offer,{now=Date.now(),recentCount=0}={}){
  const r=watch.rule||{};
  if(!watch.active||offer.status!=='active'||offer.visibility!=='public'||!(offer.capacity_remaining>0)||!offer.ends_at||Date.parse(offer.ends_at)<=now)return false;
  if(r.city&&r.city!==offer.city)return false;
  if(r.merchant_id&&r.merchant_id!==offer.merchant_id)return false;
  if(r.precinct&&r.precinct!==offer.metadata?.precinct)return false;
  if(r.verticals?.length&&!r.verticals.includes(offer.vertical))return false;
  if(r.drop_types?.length&&!r.drop_types.includes(offer.drop_type))return false;
  if(r.radius_km){const d=distanceKm(r,offer);if(d===null||d>r.radius_km)return false;}
  if(recentCount>=Math.min(10,Math.max(1,r.daily_cap||3)))return false;
  const clock=localParts(now,r.timezone),service=localParts(offer.starts_at||now,r.timezone);
  if(r.quiet_start!==undefined&&r.quiet_end!==undefined&&r.quiet_start!==r.quiet_end){
    const quiet=r.quiet_start<r.quiet_end?clock.hour>=r.quiet_start&&clock.hour<r.quiet_end:clock.hour>=r.quiet_start||clock.hour<r.quiet_end;
    if(quiet)return false;
  }
  const windows={morning:service.hour>=5&&service.hour<11,lunch:service.hour>=11&&service.hour<15,afternoon:service.hour>=15&&service.hour<18,evening:service.hour>=18,weekend:['Sat','Sun'].includes(service.day)};
  if(r.times?.length&&!r.times.some(t=>windows[t]))return false;
  return true;
}
export function qualityFlags(o,others=[]){
  const flags=[];
  if(!o.media_url)flags.push('no_image');
  if(!o.metadata?.media_rights_confirmed)flags.push('image_rights_unknown');
  if(!o.ends_at||!Number.isFinite(Date.parse(o.ends_at)))flags.push('no_expiry');
  if(!o.city||!o.location)flags.push('bad_location');
  if(!o.conditions||o.conditions.trim().length<12)flags.push('unclear_terms');
  if(o.normal_price!=null&&o.deal_price!=null&&Number(o.normal_price)<Number(o.deal_price))flags.push('normal_price_suspicious');
  if(!(Number(o.normal_price)>Number(o.deal_price))&&!(Number(o.discount_percent)>0)&&o.discount_type!=='free')flags.push('weak_value');
  if(!(o.capacity_total>0))flags.push('no_capacity');
  if(!['direct_claim','booking_claim','external_booking','merchant_confirmation','information_only','ticket','appointment'].includes(o.fulfilment_mode)||(o.action_type==='booking_claim'&&o.fulfilment_mode!=='booking_claim'))flags.push('invalid_fulfilment');
  if(others.some(x=>x.id!==o.id&&x.merchant_id===o.merchant_id&&x.title===o.title&&x.starts_at===o.starts_at))flags.push('duplicate');
  return flags;
}
export function evaluateAutopilot(rule,drop,now=Date.now()){
  const reasons=[],local=localParts(drop.starts_at,rule.timezone),lead=(Date.parse(drop.starts_at)-now)/60000;
  if(!rule.enabled)reasons.push('disabled');
  if(Number(drop.deal_price)<Number(rule.minimum_price))reasons.push('below_minimum_price');
  const discount=Number(drop.normal_price)>0?(1-Number(drop.deal_price)/Number(drop.normal_price))*100:Number(drop.discount_percent||0);
  if(discount>Number(rule.max_discount))reasons.push('discount_exceeded');
  if(!(drop.capacity_total>0)||drop.capacity_total>rule.max_quantity)reasons.push('quantity_exceeded');
  if(!rule.allowed_days?.includes(local.day))reasons.push('day_not_allowed');
  if(!rule.allowed_hours?.includes(local.hour))reasons.push('hour_not_allowed');
  if(!rule.drop_types?.includes(drop.drop_type))reasons.push('type_not_allowed');
  if(!Number.isFinite(lead)||lead<rule.min_lead_minutes||lead>rule.max_lead_minutes)reasons.push('lead_time');
  if(rule.blackouts?.some(b=>Date.parse(drop.starts_at)<Date.parse(b.end)&&Date.parse(drop.ends_at)>Date.parse(b.start)))reasons.push('blackout');
  return {eligible:!reasons.length,reasons,automatic_external_release:false};
}
