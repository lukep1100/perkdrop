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
  return <PrivateShell title="Updates"><p className="muted">Radar matches appear here in your PerkDrop access. If you use the iPhone app, you can enable device alerts in Settings; this page does not send email, SMS or browser notifications.</p>
    {error&&<p role="alert" className="error">{error} <button onClick={load}>Retry</button></p>}
    {!data&&!error&&<p role="status">Loading updatesâ€¦</p>}
    {data&&<><div className="actions"><span className="status">{data.unread||0} unr¶»§q«^