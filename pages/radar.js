import {useEffect,useState} from 'react';
import PrivateShell,{privateResponse} from '../components/PrivateShell';
import {marketplace} from '../lib/marketplace-client';
const categories=['food','drinks','events','beauty','wellness','hair','experiences','activities','fitness','golf','tourism','stay','shopping','free','services'];
export default function Radar(){
  const [watches,setWatches]=useState([]),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[geo,setGeo]=useState(null);
  const reload=()=>marketplace('watches').then(x=>setWatches(x.watches)).catch(e=>setError(e.message));
  useEffect(()=>{reload();},[]);
  async function save(e){e.preventDefault();setBusy(true);setError('');const data=new FormData(e.currentTarget);try{
    const rule={city:data.get('city'),precinct:data.get('precinct'),verticals:data.getAll('verticals'),drop_types:data.getAll('drop_types'),times:data.getAll('times'),daily_cap:Number(data.get('daily_cap')),quiet_start:Number(data.get('quiet_start')),quiet_end:Number(data.get('quiet_end')),timezone:data.get('timezone')};
    if(data.get('radius_km')){if(!geo)throw new Error('Use your location before choosing a radius.');Object.assign(rule,geo,{radius_km:Number(data.get('radius_km'))});}
    await marketplace('watch_save',{name:data.get('name'),rule});await reload();setMessage('Watch saved. Matching Drops will appear in your PerkDrop Updates. If you use the iPhone app, enable device alerts in Settings; this¶»§q«^