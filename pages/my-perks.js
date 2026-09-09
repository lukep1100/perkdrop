import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace,passState,units} from '../lib/marketplace-client';
export default function MyPerks(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('upcoming'),[recovery,setRecovery]=useState(null),[busy,setBusy]=useState(false);
  async function refresh(){setError('');try{setData(await marketplace('my_perks'));}catch(e){setError(e.message);}}
  useEffect(()=>{refresh();},[]);
  async function recoveryLink(){setBusy(true);try{setRecovery(await marketplace('recovery_link'));}catch(e){setError(e.message);}finally{setBusy(false);}}
  const passes=(data?.redemptions||[]).filter(p=>tab==='upcoming'?['active','pending'].includes(passState(p)):!['active','pending'].includes(passState(p)));
  return <PrivateShell title="My Perks"><p className="muted">Your passes are retrieved from PerkDrop’s server. This browser holds a private access key—not the authoritative pass records.</p>
    {error&&<p role="alert" className="error">{error} <button onClick={refresh}>Retry</button></p>}
    <div className="tabs" aria-label="My Perks sections">{['upcoming','past','saved','watching'].map(t=><button key={t} aria-pressed={tab===t} onClick={()=>setTab(t)}>{t.toUpperCase()}</button>)}</div>
    {!data&&!error&&<p role="status">Loading your Perks…</p>}
    {data&&['upcoming','past'].includes(tab)&&<>{passes.map(p=><section key={p.id}><span className="status">{passState(p)==='pending'?'Pending merchant confirmation':passState(p)}</span><h2>{p.metadata?.offer_title||'Your PerkDrop'}</h2><p>{units(p.metadata?.inventory_unit,p.party_size)}</p><p className="muted">{p.metadata?.valid_from?new Date(p.metadata.valid_from).toLocaleString('en-AU'):'See pass for service instructions'}</p><a className="action" href={'/perk#'+p.pass_reference}>View pass & QR</a></section>)}{!passes.length&&<section>No {tab} passes. <a href="/now">Explore available Drops.</a></section>}</>}
    {data&&tab==='saved'&&<section><h2>Saved Drops & businesses</h2>{data.saves.length?data.saves.map(s=><p key={s.kind+s.target}><a href={s.kind==='drop'?'/deals/'+encodeURIComponent(s.target):'/near-me?merchant='+encodeURIComponent(s.target)}>{s.kind}: {s.target}</a> <button onClick={async()=>{try{await marketplace('save',{kind:s.kind,target:s.target,remove:true});await refresh();}catch(e){setError(e.message);}}}>Remove</button></p>):<p>No saved Drops or followed businesses yet.</p>}</section>}
    {data&&tab==='watching'&&<section><h2>Drop Radar</h2><p>Choose the categories, places and times you want to hear about.</p><a href="/radar" className="action">Manage watches</a></section>}
    <section><h2>Move your Perks to another device</h2><p>Create a private, single-use recovery link that expires in 15 minutes. Using it rotates your access key and signs this browser out of these records. Treat the link like a password.</p><button disabled={busy} onClick={recoveryLink}>Create secure recovery link</button>{recovery&&<div role="status"><p>Expires {new Date(recovery.expires_at).toLocaleTimeString()}. Email transport is not connected; this link works without it.</p><button onClick={()=>navigator.clipboard.writeText(recovery.url).catch(()=>setError('Could not copy. Use the link below.'))}>Copy private link</button><p><a href={recovery.url} rel="noreferrer">Open recovery link</a></p></div>}<p><a href="/recover">Recover from a verified email address</a></p></section>
  </PrivateShell>;
}
export const getServerSideProps=privateResponse;
