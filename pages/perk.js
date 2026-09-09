import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace,units} from '../lib/marketplace-client';
export default function Pass(){
  const [pass,setPass]=useState(null),[error,setError]=useState(''),[qr,setQr]=useState('');
  useEffect(()=>{
    let alive=true;
    const reference=location.hash.slice(1);
    if(!/^[a-f0-9]{64}$/.test(reference)){setError('This pass link is invalid.');return;}
    const refresh=()=>marketplace('pass',{reference}).then(data=>{if(alive)setPass(data.pass);}).catch(e=>{if(alive)setError(e.message);});
    refresh();const timer=setInterval(refresh,15000);
    import('qrcode').then(q=>q.default.toDataURL(location.origin+'/perk#'+reference,{width:320,margin:2,errorCorrectionLevel:'M'})).then(url=>{if(alive)setQr(url);}).catch(()=>{});
    return()=>{alive=false;clearInterval(timer);};
  },[]);
  return <PrivateShell title="Your PerkDrop pass">{error&&<p role="alert" className="error">{error}</p>}{!pass&&!error&&<p role="status">Checking the current pass state…</p>}{pass&&<section><span className="status">{pass.state==='pending'?'Pending merchant confirmation':pass.state}</span><h2>{pass.title}</h2><p>{pass.merchant}</p><p><strong>{units(pass.unit,pass.quantity)}</strong></p>
    {pass.state==='pending'&&<p>This is a request, not a confirmed booking. The merchant must accept before the request expires.</p>}
    {qr&&<img className="qr" src={qr} alt="Read-only PerkDrop pass QR code" width="320" height="320"/>}<p><code>{pass.code}</code></p><p className="muted">Show this pass to staff. The QR can only display the pass; redemption requires the correct merchant’s signed-in account.</p>
    <dl><dt>Service</dt><dd>{pass.service_start?new Date(pass.service_start).toLocaleString('en-AU',{timeZone:pass.timezone}):'See terms'}</dd><dt>Expires</dt><dd>{new Date(pass.expires_at).toLocaleString('en-AU',{timeZone:pass.timezone})}</dd><dt>Location</dt><dd>{pass.location}</dd>{pass.booking_reference&&<><dt>Booking</dt><dd>{pass.booking_reference}</dd></>}</dl><h3>Terms</h3><p>{pass.terms||'Ask the business before redemption.'}</p>{pass.location&&<a href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(pass.location)} target="_blank" rel="noreferrer">Directions</a>}
    </section>}</PrivateShell>;
}
export const getServerSideProps=privateResponse;
