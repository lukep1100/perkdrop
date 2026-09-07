import {
  BOOKING_API,UNION_OFFER_ID,normaliseBookingEvent,nowBookItEventKind,
  safeHoldToken,safePartySize,safeServiceDate,safeSessionId,
} from '../../lib/union-pilot.mjs';

const withTimeout=()=>AbortSignal.timeout(10000);

function headers(res){
  res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');
}

function error(res,status,code){
  headers(res);
  return res.status(status).json({ok:false,error:code});
}

export const config={api:{bodyParser:{sizeLimit:'32kb'}}};

export default async function handler(req,res){
  headers(res);
  if(req.method==='GET'){
    try{
      const response=await fetch(`${BOOKING_API}?offer=${encodeURIComponent(UNION_OFFER_ID)}`,{
        headers:{accept:'application/json'},cache:'no-store',signal:withTimeout(),
      });
      const body=await response.json().catch(()=>({ok:false,error:'invalid_booking_response'}));
      return res.status(response.status).json(body);
    }catch{return error(res,502,'booking_service_unavailable')}
  }

  if(req.method!=='POST'){
    res.setHeader('Allow','GET, POST');
    return error(res,405,'method_not_allowed');
  }

  let body=req.body;
  if(typeof body==='string'){try{body=JSON.parse(body)}catch{return error(res,400,'invalid_body')}}
  if(!body||typeof body!=='object')return error(res,400,'invalid_body');
  const action=String(body.action||'').trim();
  const sessionId=safeSessionId(body.session_id);
  if(!sessionId)return error(res,400,'missing_session_id');

  const payload={action,session_id:sessionId};
  if(action==='hold'){
    const serviceDate=safeServiceDate(body.service_date);
    const partySize=safePartySize(body.party_size);
    if(!serviceDate||partySize===null)return error(res,400,'invalid_hold_request');
    Object.assign(payload,{offer_id:UNION_OFFER_ID,service_date:serviceDate,party_size:partySize});
  }else if(action==='release'){
    const token=safeHoldToken(body.hold_token);
    if(!token)return error(res,400,'invalid_hold_token');
    payload.hold_token=token;
  }else if(action==='confirm'){
    const token=safeHoldToken(body.hold_token);
    const event=normaliseBookingEvent(body.event);
    if(!token)return error(res,400,'invalid_hold_token');
    if(nowBookItEventKind(event)!=='confirmed')return error(res,400,'booking_confirmation_required');
    Object.assign(payload,{hold_token:token,event,booking_reference:String(body.booking_reference||event.event_label||'').trim().slice(0,160)});
  }else return error(res,400,'unknown_action');

  try{
    const response=await fetch(BOOKING_API,{
      method:'POST',headers:{'content-type':'application/json','accept':'application/json'},
      body:JSON.stringify(payload),cache:'no-store',signal:withTimeout(),
    });
    const result=await response.json().catch(()=>({ok:false,error:'invalid_booking_response'}));
    return res.status(response.status).json(result);
  }catch{return error(res,502,'booking_service_unavailable')}
}
