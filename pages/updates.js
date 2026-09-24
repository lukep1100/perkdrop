import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace} from '../lib/marketplace-client';

export default function Updates(){
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function load(){setError('');try{setData(await marketplace('updates'));}catch(e){setError(e.message);}}
  useEffect(()=>{load();},[]);
  async function markAll(){setBusy(true);try{await marketplace('updates_read',{all:true});await load();}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function open(update){
    if(update.read_at)return;
    try{
      await marketplace('updates_read',{id:update.id});
      setData(current=>current?{
        ...current,
        unread:Math.max(0,Number(current.unread||0)-1),
        updates:current.updates.map(item=>item.id===update.id?{...item,read_at:new Date().toISOString()}:item),
      }:current);
    }catch(e){setError(e.message);}
  }
  return <PrivateShell title="Updates"><p className="muted">Radar matches appear here in your PerkDrop access. We do not send email, SMS or browser notifications from this page.</p>
    {error&&<p role="alert" className="error">{error} <button onClick={load}>Retry</button></p>}
    {!data&&!error&&<p role="status">Loading updates…</p>}
    {data&&<><div className="actions"><span className="status">{data.unread||0} unread</span><button disabled={busy||!data.unread} onClick={markAll}>Mark all read</button></div>{data.updates.length?data.updates.map(update=><section key={update.id}><span className="status">{update.read_at?'Read':'New'}</span><h2>{update.title}</h2><p>{update.body}</p><p className="muted">{new Date(update.created_at).toLocaleString('en-AU')}</p>{update.href?<a className="action" href={update.href} onClick={()=>open(update)}>View matching Drop</a>:<button onClick={()=>open(update)}>{update.read_at?'Read':'Mark read'}</button>}</section>):<section><h2>Nothing new yet</h2><p>Save an alert in Drop Radar and matching live Drops will appear here.</p><a className="action" href="/radar">Set up a Drop Radar</a></section>}</>}
  </PrivateShell>;
}
export const getServerSideProps=privateResponse;
