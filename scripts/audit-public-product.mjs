import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const BASE='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/';
const output=new URL('../.audit/product-baseline/',import.meta.url);await mkdir(output,{recursive:true});
const start=new Date().toISOString();
const read=async url=>{const t=performance.now(),r=await fetch(url,{signal:AbortSignal.timeout(30000)});return {status:r.status,ms:Math.round(performance.now()-t),data:await r.json()}};
const catalogue=await read(BASE+'perkdrop-catalogue-api?limit=500');
const directory=await read(BASE+'perkdrop-business-directory?limit=100');
await writeFile(new URL('public-catalogue.json',output),JSON.stringify(catalogue,null,2));
await writeFile(new URL('public-directory.json',output),JSON.stringify(directory,null,2));
const assets=[...new Set(catalogue.data.deals.map(d=>d.imageUrl).filter(Boolean))];
const images=[];
async function inspect(url){
 const t=performance.now();let r;
 try{
  r=await fetch(url,{signal:AbortSignal.timeout(25000)});
  const type=(r.headers.get('content-type')||'').split(';')[0];
  if(!r.ok||!type.startsWith('image/'))return {url,status:r.status,type,error:'not_a_successful_image'};
  const reader=r.body.getReader(),parts=[];let length=0,tooLarge=false;
  while(true){const {done,value}=await reader.read();if(done)break;length+=value.length;parts.push(value);if(length>8000000){tooLarge=true;await reader.cancel();break;}}
  if(tooLarge)return {url,status:r.status,type,bytes_at_least:length,error:'over_8mb'};
  const bytes=Buffer.concat(parts);let meta;
  try{meta=await sharp(bytes,{limitInputPixels:50000000}).metadata();}catch(e){return{url,status:r.status,type,bytes:length,error:'invalid_image'};}
  return {url,status:r.status,type,bytes:length,width:meta.width,height:meta.height,format:meta.format,ms:Math.round(performance.now()-t)};
 }catch(e){return {url,status:r?.status||0,error:e.name+': '+e.message,ms:Math.round(performance.now()-t)}}
}
let next=0;await Promise.all(Array.from({length:4},async()=>{while(next<assets.length){const url=assets[next++];const value=await inspect(url);images.push(value);console.log(JSON.stringify({checked:images.length,total:assets.length,status:value.status,error:value.error||null}));}}));
const deals=catalogue.data.deals,plausible=d=>d.latitude!=null&&d.longitude!=null&&d.latitude>=-44&&d.latitude<=-10&&d.longitude>=112&&d.longitude<=154;
const report={checked_at:start,catalogue_status:catalogue.status,catalogue_ms:catalogue.ms,displayed_deals:deals.length,unique_deals:new Set(deals.map(d=>d.id)).size,map_eligible_deal_locations:deals.filter(plausible).length,map_represented_merchants:new Set(deals.filter(plausible).map(d=>d.merchantId).filter(Boolean)).size,nonmapped:deals.filter(d=>!plausible(d)).map(d=>({id:d.id,merchant:d.merchant,location:d.location})),directory_api_returned:directory.data.count,images};
await writeFile(new URL('summary.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify({done:true,...report,images:{unique:images.length,failed:images.filter(i=>i.error).length,over1mb:images.filter(i=>i.bytes>1000000).length}},null,2));
