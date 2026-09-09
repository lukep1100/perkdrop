import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace,newCredential,IDENTITY_KEY} from '../lib/marketplace-client';
export default function Recover(){
  const [token,setToken]=useState(''),[email,setEmail]=useState(''),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{setToken(location.hash.slice(1));},[]);
  async function submit(e){e.preventDefault();setBusy(true);setError('');try{
    if(token){const next=newCredential();await marketplace('recover',{token,new_credential:next});localStorage.setItem(IDENTITY_KEY,next);history.replaceState(null,'','/recover');location.replace('/my-perks');}
    else{await marketplace('recovery_email',{email});setMessage('If this is a verified address, a recovery request has been queued. Email delivery is not connected yet. Use a recovery link from your original device to move your Perks now.');}
  }catch(e){setError(e.message);}finally{setBusy(false);}}
  return <PrivateShell title="Recover your Perks"><section><form onSubmit={submit}>{token?<p>This single-use link moves access to this browser and invalidates the old browser key. Only continue if you requested it.</p>:<label>Verified email address<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label>}<button disabled={busy}>{token?'Recover on this device':'Request recovery email'}</button></form>{message&&<p role="status">{message}</p>}{error&&<p role="alert" className="error">{error}</p>}</section></PrivateShell>;
}
export const getServerSideProps=privateResponse;
