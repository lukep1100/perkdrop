export const UNION_OFFER_ID='5f1a5ca3-30ba-4747-869a-0a60edb596c7';
export const UNION_ROUTE='/deals/union-hotel-20-off-lunch';
export const BOOKING_API='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-booking-claim';
export const NOWBOOKIT_ORIGIN='https://bookings.nowbookit.com';

export const OFFER_CONDITIONS=[
  'Monday–Thursday lunch only, 11:30am–2:30pm.',
  'A real Union Hotel booking is required.',
  'Purchase of a drink is required. Drinks are not discounted.',
  'The 20% discount applies to eligible food only.',
  'Existing Union Hotel specials and promotions are excluded.',
  'One PerkDrop claim per booking. Show the valid claim code before paying.',
];

export function safeSessionId(value){
  const text=String(value||'').trim();
  return /^[a-zA-Z0-9:_-]{12,120}$/.test(text)?text:'';
}

export function safeHoldToken(value){
  const text=String(value||'').trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(text)?text:'';
}

export function safeServiceDate(value){
  const text=String(value||'').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text)?text:'';
}

export function safePartySize(value){
  const size=Number(value);
  return Number.isInteger(size)&&size>=1&&size<=6?size:null;
}

export function buildNowBookItUrl(baseUrl,serviceDate,partySize){
  const url=new URL(baseUrl);
  if(url.origin!==NOWBOOKIT_ORIGIN)throw new Error('Invalid booking provider.');
  url.searchParams.set('analytics','bubble');
  url.searchParams.set('date',safeServiceDate(serviceDate));
  url.searchParams.set('covers',String(safePartySize(partySize)||1));
  return url.toString();
}

export function parseNowBookItMessage(value){
  if(typeof value!=='string'||!value.includes('NBIWidget2GoogleAnalytics'))return null;
  try{
    const payload=JSON.parse(value);
    if(payload?.type!=='NBIWidget2GoogleAnalytics'||!payload.event||typeof payload.event!=='object')return null;
    return payload.event;
  }catch{return null}
}

export function nowBookItEventKind(event){
  if(!event)return 'ignore';
  const category=String(event.event_category||event.eventCategory||'').trim().toLowerCase();
  const action=String(event.event_action||event.eventAction||event.event||'').trim().toLowerCase();
  const title=String(event.page_title||'').trim().toLowerCase();
  if((category==='booking'&&action==='booking confirmed')||
     (category==='payment'&&action==='booking paid')||
     (category==='page view'&&title==='thank you'))return 'confirmed';
  if(action==='booking cancelled'||action==='payment booking cancelled'||title==='booking cancelled')return 'cancelled';
  return 'progress';
}

export function normaliseBookingEvent(event){
  const text=(value,max)=>String(value||'').trim().slice(0,max);
  return {
    event:text(event?.event,120),
    event_action:text(event?.event_action||event?.eventAction,120),
    event_category:text(event?.event_category||event?.eventCategory,120),
    event_label:text(event?.event_label||event?.eventLabel,220),
    page_title:text(event?.page_title,160),
    page_url:text(event?.page_url,500),
  };
}
