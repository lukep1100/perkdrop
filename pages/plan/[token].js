import {useEffect,useState} from 'react';
import {useRouter} from 'next/router';
import PrivateShell,{privateResponse} from '../../components/PrivateShell';
import {marketplacePublic} from '../../lib/marketplace-client';

export default function SharedPlan(){
  const router=useRouter(),[plan,setPlan]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    if(!router.isReady)return;
    const token=typeof router.query.token==='string'?router.query.token:'';
    if(!/^[a-f0-9]{64}$/.test(token)){setError('This shared plan link is invalid.');return;}
    marketplacePublic('plan_public',{token}).then(data=>setPlan(data.plan)).catch(()=>setError('This shared plan is unavailable or has been revoked.'));
  },[router.isReady,router.query.token]);
  return <PrivateShell title={plan?.name||'Shared plan'}>{error&&<section><p role="alert" className="error">{error}</p><a className="action" href="/">Explore current Drops</a></section>}{!plan&&!error&&<p role="status">Opening shared plan…</p>}{plan&&<section><span className="status">Shared plan</span><h2>{plan.name}</h2>{plan.planned_for&&<p className="muted">{new Date(`${plan.planned_for}T12:00:00`).toLocaleDateString('en-AU',{weekday:'long',day:'numeric',month:'long'})}</p>}{plan.note&&<p>{plan.note}</p>}<ol>{plan.items.map(item=><li key={item.id}>{item.href?<a href={item.href}>{item.merchant} — {item.title}</a>:<span>{item.merchant?`${item.merchant} — `:''}{item.title}</span>}{!item.available&&' (no longer available)'}</li>)}</ol>{!plan.items.length&&<p>None of the Drops in this plan are currently available. Explore the live local guide for current options.</p>}<p className="muted">This is a shared shortlist, not a booking or reservation. Check each venue’s current conditions before you go.</p></section>}</PrivateShell>;
}
export const getServerSideProps=privateResponse;
