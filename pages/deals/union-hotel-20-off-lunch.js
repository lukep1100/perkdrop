import Head from 'next/head';
import {useEffect,useMemo,useRef,useState} from 'react';
import {
  NOWBOOKIT_ORIGIN,OFFER_CONDITIONS,buildNowBookItUrl,
  nowBookItEventKind,parseNowBookItMessage,safeSessionId,
} from '../../lib/union-pilot.mjs';

const HOLD_KEY='perkdrop_union_hold_v1';
const SESSION_KEY='perkdrop_union_session_v1';
const CLAIM_KEY='perkdrop_union_claim_v1';

const messages={
  booking_service_unavailable:'Live booking availability is temporarily unavailable. Please try again shortly.',
  booking_claim_not_available:'This PerkDrop offer is not available right now.',
  insufficient_capacity:'There are not enough PerkDrop diner spots left for that party size.',
  session_not_available:'That lunch session is no longer available.',
  hold_expired:'Your temporary hold expired. The diner spots have been returned.',
  booking_confirmation_required:'Finish the real Union Hotel booking before confirming the PerkDrop claim.',
};

const request=async(options={})=>{
  const response=await fetch('/api/union-booking',{cache:'no-store',...options,headers:{accept:'application/json',...(options.headers||{})}});
  const body=await response.json().catch(()=>({ok:false,error:'invalid_booking_response'}));
  if(!response.ok||!body.ok){const error=new Error(messages[body.error]||'Something went wrong. Please try again.');error.code=body.error;throw error}
  return body;
};

function dateLabel(value){
  const [year,month,day]=String(value).split('-').map(Number);
  return new Intl.DateTimeFormat('en-AU',{weekday:'short',day:'numeric',month:'short'}).format(new Date(year,month-1,day));
}

function timeLabel(value){
  const [hour,minute]=String(value||'').split(':').map(Number);
  const suffix=hour>=12?'pm':'am';
  return `${hour%12||12}:${String(minute||0).padStart(2,'0')}${suffix}`;
}

function Conditions({confirmation=false}){
  return <section className="conditions" aria-labelledby={confirmation?'confirmed-conditions':'offer-conditions'}>
    <h2 id={confirmation?'confirmed-conditions':'offer-conditions'}>{confirmation?'Your claim conditions':'Conditions before you book'}</h2>
    <ul>{OFFER_CONDITIONS.map(item=><li key={item}>{item}</li>)}</ul>
  </section>;
}

export default function UnionHotelPilot(){
  const [data,setData]=useState(null),[selectedDate,setSelectedDate]=useState(''),[partySize,setPartySize]=useState(2),[sessionId,setSessionId]=useState(''),[hold,setHold]=useState(null),[claim,setClaim]=useState(null),[acknowledged,setAcknowledged]=useState(false),[loading,setLoading]=useState(true),[working,setWorking]=useState(false),[error,setError]=useState(''),[secondsLeft,setSecondsLeft]=useState(0);
  const iframeRef=useRef(null),confirmingRef=useRef(false),releasingRef=useRef(false);

  async function loadAvailability(){
    try{
      const next=await request();
      setData(next);
      setSelectedDate(current=>current&&next.sessions.some(item=>item.service_date===current)?current:(next.sessions.find(item=>Number(item.capacity_remaining)>0)?.service_date||next.sessions[0]?.service_date||''));
      setError('');
    }catch(problem){setError(problem.message)}finally{setLoading(false)}
  }

  useEffect(()=>{
    let id=sessionStorage.getItem(SESSION_KEY)||'';
    if(!safeSessionId(id)){id=`pd_union_${crypto.randomUUID()}`;sessionStorage.setItem(SESSION_KEY,id)}
    setSessionId(id);
    try{
      const savedClaim=JSON.parse(sessionStorage.getItem(CLAIM_KEY)||'null');
      if(savedClaim?.code)setClaim(savedClaim);
      const savedHold=JSON.parse(sessionStorage.getItem(HOLD_KEY)||'null');
      if(savedHold?.token&&new Date(savedHold.expires_at)>new Date()){
        setHold(savedHold);setSelectedDate(savedHold.service_date);setPartySize(Number(savedHold.party_size)||2);
      }else sessionStorage.removeItem(HOLD_KEY);
    }catch{sessionStorage.removeItem(HOLD_KEY);sessionStorage.removeItem(CLAIM_KEY)}
    loadAvailability();
    const refresh=setInterval(()=>{if(!document.hidden)loadAvailability()},30000);
    return()=>clearInterval(refresh);
  },[]);

  useEffect(()=>{
    if(!hold)return;
    const tick=()=>{
      const remaining=Math.max(0,Math.ceil((new Date(hold.expires_at).getTime()-Date.now())/1000));
      setSecondsLeft(remaining);
      if(!remaining)releaseHold(true);
    };
    tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer);
  },[hold?.token]);

  useEffect(()=>{
    if(!hold||claim||!sessionId)return;
    const onMessage=event=>{
      if(event.origin!==NOWBOOKIT_ORIGIN||event.source!==iframeRef.current?.contentWindow)return;
      const bookingEvent=parseNowBookItMessage(event.data);
      const kind=nowBookItEventKind(bookingEvent);
      if(kind==='confirmed')confirmBooking(bookingEvent);
      if(kind==='cancelled')releaseHold(false);
    };
    const onPageHide=()=>{
      const payload=JSON.stringify({action:'release',hold_token:hold.token,session_id:sessionId});
      sessionStorage.removeItem(HOLD_KEY);
      navigator.sendBeacon('/api/union-booking',new Blob([payload],{type:'application/json'}));
    };
    window.addEventListener('message',onMessage);
    window.addEventListener('pagehide',onPageHide);
    return()=>{window.removeEventListener('message',onMessage);window.removeEventListener('pagehide',onPageHide)};
  },[hold?.token,claim,sessionId]);

  async function startBooking(){
    if(!sessionId||!selectedDate||!acknowledged)return;
    setWorking(true);setError('');
    try{
      const result=await request({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'hold',session_id:sessionId,service_date:selectedDate,party_size:partySize})});
      if(result.confirmed)throw new Error('This browser session already has a confirmed claim for that lunch.');
      const nextHold={...result.hold,token:result.hold.token||result.hold.hold_token,service_date:selectedDate,party_size:partySize};
      sessionStorage.setItem(HOLD_KEY,JSON.stringify(nextHold));
      setHold(nextHold);
      setData(current=>({...current,sessions:current.sessions.map(item=>item.service_date===selectedDate?{...item,capacity_remaining:result.capacity_remaining}:item)}));
    }catch(problem){setError(problem.message)}finally{setWorking(false)}
  }

  async function releaseHold(expired=false){
    if(!hold||releasingRef.current)return;
    releasingRef.current=true;const releasing=hold;setWorking(true);sessionStorage.removeItem(HOLD_KEY);
    try{await request({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'release',hold_token:releasing.token,session_id:sessionId})})}catch{}
    setHold(null);setSecondsLeft(0);setWorking(false);setError(expired?messages.hold_expired:'');await loadAvailability();releasingRef.current=false;
  }

  async function confirmBooking(bookingEvent){
    if(!hold||confirmingRef.current)return;
    confirmingRef.current=true;setWorking(true);setError('');
    try{
      const result=await request({method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'confirm',hold_token:hold.token,session_id:sessionId,event:bookingEvent,booking_reference:bookingEvent.event_label||''})});
      const confirmed={...result.redemption,service_date:result.redemption.service_date||hold.service_date,party_size:result.redemption.party_size||hold.party_size};
      sessionStorage.removeItem(HOLD_KEY);sessionStorage.setItem(CLAIM_KEY,JSON.stringify(confirmed));setClaim(confirmed);setHold(null);await loadAvailability();
    }catch(problem){setError(problem.message)}finally{setWorking(false);confirmingRef.current=false}
  }

  const selected=useMemo(()=>data?.sessions?.find(item=>item.service_date===selectedDate)||null,[data,selectedDate]);
  const canHold=Boolean(selected&&Number(selected.capacity_remaining)>=partySize&&acknowledged&&!working&&!hold);
  const widgetUrl=hold&&data?.offer?.booking_url?buildNowBookItUrl(data.offer.booking_url,hold.service_date,hold.party_size):'';
  const countdown=`${Math.floor(secondsLeft/60)}:${String(secondsLeft%60).padStart(2,'0')}`;

  return <div className="app-shell union-pilot">
    <Head>
      <title>20% off food at Union Hotel | PerkDrop</title>
      <meta name="description" content="Book a Monday–Thursday Union Hotel lunch and claim 20% off eligible food with a drink purchase."/>
      <meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"/>
      <meta name="robots" content="noindex,nofollow"/>
      <meta name="theme-color" content="#08090e"/>
      <link rel="icon" href="/icon.svg"/>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap"/>
      <link rel="stylesheet" href="/styles.css?v=v23-operations"/>
    </Head>
    <header className="topbar"><div className="topbar-inner"><a className="wordmark" href="/"><span className="brand-icon"><img src="/icon.svg" alt=""/></span><span className="brand-text">Perk<span>Drop</span></span></a><span className="pilot-pill">UNION HOTEL PILOT</span></div></header>
    <main className="page union-main">
      <a className="back-link" href="/">← Back to Drops</a>
      <section className="offer-hero">
        <div className="eyebrow">PERKDROP DINER OFFER · UNION HOTEL</div>
        <div className="offer-badge">20% OFF FOOD</div>
        <h1>20% OFF FOOD — <span>purchase of a drink required</span></h1>
        <p className="venue">Union Hotel · 70 Waymouth St, Adelaide</p>
        <p>Monday–Thursday lunch · 11:30am–2:30pm · 20 PerkDrop diner spots per lunch</p>
      </section>

      {claim?<section className="claim-card" aria-live="polite">
        <div className="success-mark">✓</div><div className="eyebrow">BOOKING CONFIRMED · PERKDROP CLAIM READY</div><h2>Your claim code</h2><div className="claim-code">{claim.code}</div>
        <div className="claim-facts"><div><span>Date</span><b>{dateLabel(claim.service_date)}</b></div><div><span>Lunch</span><b>{timeLabel(claim.service_start||'11:30')}–{timeLabel(claim.service_end||'14:30')}</b></div><div><span>Party size</span><b>{claim.party_size} {Number(claim.party_size)===1?'diner':'diners'}</b></div></div>
        <p className="claim-note">Show this code to the Union Hotel team before paying. The code and confirmed party size can be verified in the existing PerkDrop merchant system.</p><Conditions confirmation/>
      </section>:<>
        {!hold&&<div className="booking-grid"><section className="booking-card"><div className="section-title"><div><div className="eyebrow">1 · CHOOSE YOUR LUNCH</div><h2>Live PerkDrop diner spots</h2></div>{!loading&&<button className="refresh" onClick={loadAvailability}>Refresh</button>}</div>
          {loading?<p className="muted">Loading live diner spots…</p>:data?.sessions?.length?<div className="sessions" role="radiogroup" aria-label="Eligible lunch dates">{data.sessions.map(item=>{const remaining=Number(item.capacity_remaining||0),soldOut=remaining===0;return <button type="button" role="radio" aria-checked={selectedDate===item.service_date} className={`session ${selectedDate===item.service_date?'selected':''}`} key={item.id} disabled={soldOut} onClick={()=>setSelectedDate(item.service_date)}><span>{dateLabel(item.service_date)}</span><b className={soldOut?'sold':''}>{soldOut?'SOLD OUT':`${remaining} ${remaining===1?'spot':'spots'} left`}</b><small>{timeLabel(item.service_start)}–{timeLabel(item.service_end)}</small></button>})}</div>:<p className="error-box">No eligible Union Hotel lunch sessions are currently available.</p>}
          <label className="party">Party size<select value={partySize} onChange={event=>setPartySize(Number(event.target.value))} disabled={working}>{[1,2,3,4,5,6].map(size=><option key={size} value={size}>{size} {size===1?'diner':'diners'}</option>)}</select></label>
          {selected&&Number(selected.capacity_remaining)<partySize&&<p className="error-box">Only {selected.capacity_remaining} {Number(selected.capacity_remaining)===1?'spot is':'spots are'} left. Choose a smaller party or another date.</p>}
        </section><Conditions/></div>}

        {!hold&&<section className="hold-card"><label className="confirm-check"><input type="checkbox" checked={acknowledged} onChange={event=>setAcknowledged(event.target.checked)}/><span>I have read the conditions and understand I must complete a real Union Hotel booking for the selected date and party size.</span></label><button className="btn primary hold-button" disabled={!canHold} onClick={startBooking}>{working?'Holding diner spots…':'Hold spots & book with Union Hotel'}</button><p className="fine-print">Your selected PerkDrop diner spots are held for 10 minutes while you complete the booking. No claim code is issued until NowBookIt confirms the booking.</p></section>}

        {hold&&<section className="widget-card"><div className="widget-head"><div><div className="eyebrow">2 · COMPLETE THE REAL BOOKING</div><h2>Book with Union Hotel in NowBookIt</h2><p>{dateLabel(hold.service_date)} · {hold.party_size} {hold.party_size===1?'diner':'diners'}</p></div><div className="timer" aria-live="polite"><span>Spots held</span><b>{countdown}</b></div></div><div className="widget-warning">Keep the selected date and party size the same in NowBookIt. Your PerkDrop claim is issued automatically only after the booking confirmation step.</div><iframe ref={iframeRef} className="booking-widget" src={widgetUrl} title="Union Hotel booking powered by NowBookIt" allow="payment *" referrerPolicy="strict-origin-when-cross-origin"/><div className="widget-actions"><button className="btn secondary" disabled={working} onClick={()=>releaseHold(false)}>Cancel and release spots</button></div><Conditions/></section>}
      </>}
      {error&&<p className="error-box" role="alert">{error}</p>}
    </main>
    <style jsx global>{`
      .union-main{max-width:980px;padding-top:22px}.pilot-pill{border:1px solid #46375f;border-radius:999px;padding:7px 10px;color:#d9c8ff;font-size:10px;font-weight:900;letter-spacing:.6px}.back-link{display:inline-block;margin-bottom:14px;color:#aeb4c0;text-decoration:none;font-size:12px}.offer-hero{border:1px solid #342d48;border-radius:24px;padding:clamp(22px,5vw,46px);background:radial-gradient(circle at 88% 10%,rgba(255,77,184,.22),transparent 35%),radial-gradient(circle at 10% 95%,rgba(108,59,255,.22),transparent 40%),#0d0f17}.offer-badge{display:inline-block;margin-top:16px;padding:9px 12px;border-radius:12px;background:linear-gradient(135deg,#ff4db8,#6c3bff);font-size:13px;font-weight:900}.offer-hero h1{max-width:760px;margin:13px 0 10px;font-size:clamp(32px,7vw,62px);line-height:1.03;letter-spacing:-1.8px}.offer-hero h1 span{color:#ffc700}.offer-hero p{margin:8px 0;color:#c4c8d2}.offer-hero .venue{font-weight:800;color:#fff}.booking-grid{display:grid;grid-template-columns:1.3fr .9fr;gap:16px;margin-top:18px}.booking-card,.conditions,.hold-card,.widget-card,.claim-card{border:1px solid #292e3d;border-radius:20px;background:#10121a;padding:18px}.section-title,.widget-head{display:flex;justify-content:space-between;align-items:flex-start;gap:16px}.section-title h2,.widget-head h2,.conditions h2,.claim-card h2{margin:5px 0 12px;font-size:21px}.refresh{border:1px solid #343949;background:#171a24;color:#fff;border-radius:11px;padding:8px 10px;font-weight:800;font-size:11px}.sessions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;max-height:390px;overflow:auto;padding-right:3px}.session{display:grid;gap:3px;text-align:left;border:1px solid #303545;background:#151823;color:#fff;border-radius:14px;padding:12px;cursor:pointer}.session.selected{border-color:#ff4db8;box-shadow:0 0 0 2px rgba(255,77,184,.13)}.session:disabled{opacity:.62;cursor:not-allowed}.session span{font-weight:800}.session b{color:#30e0c1;font-size:12px}.session b.sold{color:#ff8297}.session small{color:#9097a5}.party{display:grid;gap:6px;margin-top:15px;font-size:12px;font-weight:800}.party select{width:100%;border:1px solid #343949;background:#171a24;color:#fff;border-radius:12px;padding:12px}.conditions ul{margin:0;padding-left:19px}.conditions li{margin:0 0 9px;color:#c8ccd5;font-size:13px;line-height:1.55}.hold-card{margin-top:16px}.confirm-check{display:grid;grid-template-columns:auto 1fr;gap:10px;align-items:flex-start;color:#d7dae2;font-size:13px;line-height:1.55}.confirm-check input{width:18px;height:18px;margin-top:2px;accent-color:#ff4db8}.hold-button{width:100%;margin-top:14px;min-height:50px}.hold-button:disabled{opacity:.5;cursor:not-allowed}.fine-print{margin:10px 0 0;color:#8f95a5;font-size:11px;line-height:1.55}.widget-card{margin-top:18px}.widget-head p{margin:0;color:#b9bec9}.timer{min-width:96px;border:1px solid #61488f;background:#19142a;border-radius:14px;padding:10px;text-align:center}.timer span{display:block;color:#bcaee0;font-size:10px}.timer b{display:block;margin-top:2px;font-size:21px}.widget-warning{margin:14px 0;padding:12px;border:1px solid rgba(255,199,0,.35);border-radius:13px;background:rgba(255,199,0,.06);color:#f5dda0;font-size:12px}.booking-widget{display:block;width:100%;height:760px;border:0;border-radius:14px;background:#171a24}.widget-actions{display:flex;justify-content:space-between;align-items:center;gap:12px;margin:12px 0 18px}.widget-actions a{color:#d8c8ff;font-size:12px}.error-box{border:1px solid #7c2c3a;border-radius:13px;background:#2a1116;color:#ff9aaa;padding:12px;font-size:12px}.claim-card{margin-top:18px;text-align:center;border-color:#2a7568;background:radial-gradient(circle at 50% 0,rgba(48,224,193,.12),transparent 38%),#10121a}.success-mark{display:grid;place-items:center;width:48px;height:48px;margin:0 auto 10px;border-radius:50%;background:#163d36;color:#30e0c1;font-size:25px;font-weight:900}.claim-code{display:inline-block;margin:7px 0 18px;padding:14px 20px;border:1px dashed #8b67d8;border-radius:14px;background:#18142a;font-size:clamp(27px,6vw,42px);font-weight:900;letter-spacing:2px}.claim-facts{display:grid;grid-template-columns:repeat(3,1fr);gap:9px;max-width:680px;margin:auto}.claim-facts div{border:1px solid #292e3d;border-radius:13px;padding:12px;background:#151823}.claim-facts span,.claim-facts b{display:block}.claim-facts span{color:#959cab;font-size:10px}.claim-facts b{margin-top:4px;font-size:13px}.claim-note{max-width:700px;margin:16px auto;color:#c8ccd5}.claim-card .conditions{text-align:left;margin-top:16px;background:#0e1017}.muted{color:#aeb4c0}
      @media(max-width:760px){.booking-grid{grid-template-columns:1fr}.offer-hero h1{letter-spacing:-1px}.booking-widget{height:690px}.widget-head{align-items:flex-start}.claim-facts{grid-template-columns:1fr}.union-main{padding-bottom:calc(28px + env(safe-area-inset-bottom,0px))}}
      @media(max-width:430px){.pilot-pill{font-size:8px;padding:6px 8px}.offer-hero{padding:20px}.offer-hero h1{font-size:34px}.sessions{grid-template-columns:1fr;max-height:430px}.widget-head{display:grid;grid-template-columns:1fr auto}.timer{grid-column:2;grid-row:1/3}.booking-widget{height:640px;margin-left:-6px;width:calc(100% + 12px)}.widget-actions{align-items:stretch;flex-direction:column}.widget-actions .btn,.widget-actions a{width:100%;text-align:center}.booking-card,.conditions,.hold-card,.widget-card,.claim-card{padding:15px}}
    `}</style>
  </div>;
}

export function getServerSideProps({res}){
  res.setHeader('Cache-Control','private, no-store');
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  return {props:{}};
}
