import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace,newCredential,IDENTITY_KEY} from '../lib/marketplace-client';
export default function Recover(){
  const [token,setToken]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
  useEffect(()=>{setToken(location.hash.slice(1));},[]);
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{
    const next=newCredential();await marketplace('recover',{token,new_credential:next});localStorage.setItem(IDENTITY_KEY,next);history.replaceState(null,'','/recover');location.replace('/my-perks');
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  return <PrivateShell title="Recover your Perks">{token?<section><form onSubmit={submit}><p>This single-use link moves access to this browser and invalidates the old browser key. Only continue if you requested it.</p><button disabled={busy}>Recover on this device</button></form>{error&&<p role="alert" className="error">{error}</p>}</section>:<section><h2>Use a private transfer link</h2><p>Email recovery is not enabled yet. On the device that still has your PerkDrop access, open Saved & passes and create a private transfer link. It works once and expires after 15 minutes.</p><a className="action" href="/my-perks">Open Saved & passes</a></section>}</PrivateShell>;
}
export const getServerSideProps=privateResponse;
