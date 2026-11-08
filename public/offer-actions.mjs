import {isUnconditionallyFree,listingEnded} from './discovery-rules.mjs';

function webUrl(value) {
  if(typeof value!=='string'||!value.trim()||/[\u0000-\u001f\\]/.test(value))return null;
  try{const u=new URL(value,'https://perkdrop.au');return ['https:','http:'].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
export function offerValue(item={}) {
  const percent=Number(item.discountPercent??item.discount_percent);
  if(Number.isFinite(percent)&&percent>0&&percent<=100)return Math.round(percent)+'% off';
  if(isUnconditionallyFree(item))return 'Free entry';
  if(/^(free|\$0(?:\.00)?)$/i.test(String(item.price||'').trim()))return 'Conditional offer';
  const price=String(item.price||'Check price');
  return /check|confirm|option listed/i.test(price)?'Check price':price;
}
// A booking link must never become a claim button. Only live, server-backed
// inventory can produce a PerkDrop pass; directory/source listings stay external.
export function offerAction(item={}, {offline=false,now=new Date()}={}) {
  const mode=item.fulfilmentMode||item.fulfilment_mode||(item.redemptionAvailable?'direct_claim':'information_only');
  const booking=['booking_claim','external_booking','ticket','appointment'].includes(mode);
  const sources=[item.goUrl,item.go_url,item.official,item.officialSource,item.official_source,item.source];
  const source=(booking?[item.merchantBookingUrl,item.merchant_booking_url,...sources]:sources).map(webUrl).find(Boolean)||null;
  if(listingEnded(item,now))return {kind:'unavailable',label:'Offer ended',url:null,note:'This listing has ended. Explore current listings instead.'};
  if(['direct_claim','merchant_confirmation'].includes(mode)&&item.redemptionAvailable&&item.merchantOfferId){
    if(offline)return {kind:'unavailable',label:'Refresh to claim',url:null,note:'Reconnect and refresh live availability before claiming.'};
    if(!(Number(item.capacityRemaining)>0))return {kind:'unavailable',label:'Currently unavailable',url:null,note:'There are no claimable places left. Check again for new availability.'};
    return {kind:'claim',label:mode==='merchant_confirmation'?'Request confirmation':'Claim this Drop',url:null,note:mode==='merchant_confirmation'?'Request your quantity, then wait for the venue to confirm before attending.':'Check the time and conditions, claim your quantity, then show your pass as directed. A pass is not a table booking unless stated.'};
  }
  return {kind:source?'external':'unavailable',label:source?(booking?(mode==='ticket'?'View tickets':'Book with the venue'):'View at source'):'Details unavailable',url:source,note:booking?'Complete your booking with the venue or organiser. Opening the link does not confirm a booking or issue a PerkDrop pass.':'Check the venue or organiser’s current price, times and conditions before you go. This listing does not issue a PerkDrop pass.'};
}
