import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace} from '../lib/marketplace-client';

const cities=[['adelaide','Adelaide'],['sydney','Sydney'],['melbourne','Melbourne'],['brisbane','Brisbane'],['perth','Perth'],['darwin','Darwin'],['canberra','Canberra'],['hobart','Hobart'],['gold-coast','Gold Coast']];
const interests=[['food','Food & drink'],['drinks','Drinks'],['events','Events'],['experiences','Things to do'],['beauty','Beauty'],['wellness','Wellness'],['activities','Activities'],['fitness','Fitness'],['shopping','Shopping'],['free','Free things to do']];

export default function Preferences(){
  const [value,setValue]=useState(null),[busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  useEffect(()=>{marketplace('preferences').then(data=>setValue(data.preferences)).catch(e=>setError(e.message));},[]);
  async function save(event){
    event.preventDefault();
    const form=new FormData(event.currentTarget);
    const preferences={city:form.get('city'),verticals:form.getAll('verticals'),radius_km:Number(form.get('radius_km')),intent:form.get('intent')};
    setBusy(true);setError('');
    try{
      const result=await marketplace('preferences_save',{preferences});
      setValue(result.preferences);
      if(result.preferences.city)localStorage.setItem('perkdrop_city',result.preferences.city);
      setMessage('Your local guide is ready. Home picks will use these choices on this PerkDrop access.');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  if(!value&&!error)return <PrivateShell title="Your local guide"><p role="status">Loading your choices…</p></PrivateShell>;
  const selected=new Set(value?.verticals||[]);
  return <PrivateShell title="Your local guide"><p className="muted">Choose what is useful to you. These choices tune the Home shortlist; they do not subscribe you to marketing or turn on notifications.</p>
    {error&&<p role="alert" className="error">{error}</p>}
    <section><form onSubmit={save}><label>Home city<select name="city" defaultValue={value?.city||'adelaide'}>{cities.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <fieldset><legend>What are you most interested in?</legend><div className="choice-grid">{interests.map(([key,label])=><label key={key}><input type="checkbox" name="verticals" value={key} defaultChecked={selected.has(key)}/> {label}</label>)}</div></fieldset>
      <label>How far are you willing to travel?<select name="radius_km" defaultValue={String(value?.radius_km||25)}><option value="10">Close by — about 10 km</option><option value="25">Around my city — about 25 km</option><option value="50">Worth a trip — about 50 km</option></select></label>
      <label>Prioritise<select name="intent" defaultValue={value?.intent||'any'}><option value="any">A useful local shortlist</option><option value="tonight">Things that work tonight</option><option value="weekend">Ideas for this weekend</option></select></label>
      <button disabled={busy}>{busy?'Saving…':'Save my local guide'}</button>
    </form>{message&&<p role="status">{message}</p>}</section>
    <p className="muted">Your choices move with a private transfer link from My Perks. Email recovery and browser push are not enabled yet.</p>
  </PrivateShell>;
}
export const getServerSideProps=privateResponse;
