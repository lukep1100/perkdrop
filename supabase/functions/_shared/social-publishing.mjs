import { inflateSync } from 'node:zlib';

export const MAX_BYTES = 8_000_000;
export const MEDIA_BASE = 'https://perkdrop.au/social-media/';
export const EXPECTED_CHANNELS = {
  instagram: { id: '6a90f9b8ccaf649a672f3bc7', name: 'perkdropofficial' },
  facebook: { id: '6a90f974ccaf649a672f36f2', name: 'Perkdrop' },
};
export const sha256 = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  typeof bytes === 'string' ? new TextEncoder().encode(bytes) : bytes))).map(x => x.toString(16).padStart(2,'0')).join('');
const crcTable = Array.from({length:256},(_,i) => {
  for(let k=0;k<8;k++) i = i&1 ? 0xedb88320^(i>>>1) : i>>>1;
  return i>>>0;
});
const crc32 = bytes => {
  let c=0xffffffff;
  for(const b of bytes) c=crcTable[(c^b)&255]^(c>>>8);
  return (c^0xffffffff)>>>0;
};
export function inspectPng(bytes) {
  if(bytes.length>MAX_BYTES || bytes.length<57) throw new Error('PNG size is invalid (maximum 8 MB).');
  if(![137,80,78,71,13,10,26,10].every((b,i)=>bytes[i]===b)) throw new Error('File is not a PNG.');
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  let p=8,width=0,height=0,channels=0,ended=false; const chunks=[];
  while(p+12<=bytes.length) {
    const n=view.getUint32(p),end=p+12+n;
    const type=String.fromCharCode(...bytes.subarray(p+4,p+8));
    if(end>bytes.length) throw new Error('Truncated PNG: '+type+' chunk is incomplete.');
    if(crc32(bytes.subarray(p+4,p+8+n))!==view.getUint32(p+8+n)) throw new Error('Corrupt PNG: '+type+' checksum failed.');
    if(p===8 && type!=='IHDR') throw new Error('PNG header is missing.');
    if(type==='IHDR') {
      if(n!==13 || width) throw new Error('Invalid PNG header.');
      width=view.getUint32(p+8);height=view.getUint32(p+12);
      channels=({0:1,2:3,4:2,6:4})[bytes[p+17]];
      if(!channels || bytes[p+16]!==8 || bytes[p+18]!==0 || bytes[p+19]!==0 || bytes[p+20]!==0)
        throw new Error('Use a non-interlaced 8-bit RGB, RGBA or grayscale PNG.');
      if(width<320 || width>4096 || height<320 || height>4096 || width*height>17_000_000)
        throw new Error('PNG dimensions must be 320–4096 pixels.');
    }
    if(type==='acTL') throw new Error('Animated PNGs are not supported.');
    if(type==='IDAT') chunks.push(bytes.subarray(p+8,p+8+n));
    p=end;
    if(type==='IEND'){if(n!==0 || p!==bytes.length) throw new Error('Invalid PNG end.'); ended=true;break;}
  }
  if(!ended||!chunks.length) throw new Error('Truncated PNG: image data or IEND is missing.');
  const length=chunks.reduce((s,x)=>s+x.length,0),compressed=new Uint8Array(length);let offset=0;
  for(const chunk of chunks){compressed.set(chunk,offset);offset+=chunk.length;}
  const stride=width*channels+1,required=stride*height;
  const decoded=inflateSync(compressed,{maxOutputLength:required});
  if(decoded.length!==required) throw new Error('PNG pixel data is incomplete.');
  for(let i=0;i<decoded.length;i+=stride) if(decoded[i]>4) throw new Error('Invalid PNG scanline.');
  return {width,height,byte_size:bytes.length,mime_type:'image/png'};
}
export function validateManifest(files) {
  if(!Array.isArray(files)||files.length!==5) throw new Error('Exactly five finished PNG slides are required.');
  const seen=new Set();
  return files.map((f,i)=>{
    if(!/^[a-f0-9]{64}$/.test(f.sha256||'') || !Number.isInteger(f.byte_size) || f.byte_size<57 || f.byte_size>MAX_BYTES ||
      typeof f.filename!=='string' || !f.filename.toLowerCase().endsWith('.png')) throw new Error('Invalid slide '+(i+1)+' manifest.');
    if(seen.has(f.sha256)) throw new Error('Each carousel slide must be a different file.');
    seen.add(f.sha256);
    return {order:i+1,filename:f.filename.slice(0,160),sha256:f.sha256,byte_size:f.byte_size,
      storage_path:f.sha256+'.png',public_url:MEDIA_BASE+f.sha256+'.png'};
  });
}
const canonical = value => Array.isArray(value) ? value.map(canonical) :
  value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])) : value;
export const fingerprint = job => sha256(JSON.stringify(canonical({caption:job.caption,channels:job.channels,assets:job.assets})));
export async function fetchPng(asset,fetcher=fetch) {
  if(asset.public_url!==MEDIA_BASE+asset.sha256+'.png') throw new Error('Untrusted media URL.');
  const r=await fetcher(asset.public_url,{redirect:'error',signal:AbortSignal.timeout(20000),cache:'no-store'});
  if(!r.ok) throw new Error('Slide '+asset.order+': HTTP '+r.status);
  if((r.headers.get('content-type')||'').split(';')[0]!=='image/png') throw new Error('Slide '+asset.order+': response is not image/png.');
  if(Number(r.headers.get('content-length'))>MAX_BYTES) throw new Error('PNG response exceeds 8 MB.');
  const reader=r.body.getReader(),parts=[];let size=0;
  try {while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BYTES)throw new Error('PNG response exceeds 8 MB.');parts.push(value);}}
  finally {await reader.cancel().catch(()=>{});}
  const bytes=new Uint8Array(size);let pos=0;for(const part of parts){bytes.set(part,pos);pos+=part.length;}
  const hash=await sha256(bytes);
  if(hash!==asset.sha256 || size!==asset.byte_size) throw new Error('Slide '+asset.order+': hosted bytes differ from the original.');
  return {...inspectPng(bytes),order:asset.order,sha256:hash,url:asset.public_url,http_status:r.status,verified_at:new Date().toISOString()};
}
export function draftInput(job,channel) {
  if(!EXPECTED_CHANNELS[channel.platform] || channel.id!==EXPECTED_CHANNELS[channel.platform].id) throw new Error('Unexpected Buffer channel.');
  return {text:job.caption,channelId:channel.id,schedulingType:'automatic',mode:'addToQueue',saveToDraft:true,needsApproval:false,
    assets:job.assets.map(a=>({image:{url:a.public_url}})),
    metadata:channel.platform==='instagram'?{instagram:{type:'post',isAiGenerated:false,shouldShareToFeed:true}}:{facebook:{type:'post'}}};
}
export function assertDraft(post,job,channel) {
  if(!post?.id || post.status!=='draft' || post.text!==job.caption || post.channelId!==channel.id || post.assets?.length!==5)
    throw new Error('Buffer returned a post that does not match the approved draft.');
  if(post.assets.some((a,i)=>a.source!==job.assets[i].public_url || a.mimeType!=='image/png'))
    throw new Error('Buffer media order/URLs are not yet verified. Reconcile before continuing.');
}
