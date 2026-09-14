import {readFile} from 'node:fs/promises';
import {validateManifest,sha256,fetchPng} from '../supabase/functions/_shared/social-publishing.mjs';
const hashes=[
 '19dda3a96d6fe4982a6db9930863990cd3a5685dcd796ccea27e499eb7e42c98',
 'a9a9b13fb92ea4e7217971a4af9484ce3a7629a374263624da172ccd54f6f775',
 '5843c63468dc94b2cf5f27d863c5751b43f45e3959022cf99b55051b234ab777',
 '21b97c8a69eed82bc91923d0ac780211fdb74c6b52d830cf71f05a43c1ca908b',
 '8a4ccd07ebf9d72ce6d8aed880f0a1d6b3fc57631c84a42ae95b6ec338a935f5',
];
const manifest=[];
for(const [i,hash] of hashes.entries()){
 const bytes=await readFile(new URL('../public/social-media/'+hash+'.png',import.meta.url));
 if(await sha256(bytes)!==hash)throw new Error('Local original hash mismatch.');
 manifest.push({filename:'0'+(i+1)+'.png',sha256:hash,byte_size:bytes.length});
}
const verification=[];
for(const asset of validateManifest(manifest)){
 let http;
 try{
  // Capture transport independently: a damaged PNG can still be hosted as image/png.
  const r=await fetch(asset.public_url,{redirect:'error',method:'HEAD',signal:AbortSignal.timeout(20000),cache:'no-store'});
  http={http_status:r.status,content_type:r.headers.get('content-type')};
  verification.push({ok:true,...http,...await fetchPng(asset)});
 }catch(e){verification.push({ok:false,order:asset.order,url:asset.public_url,...http,error:e.message,verified_at:new Date().toISOString()});}
}
console.log(JSON.stringify({verification,all_valid:verification.every(v=>v.ok)},null,2));
if(!verification.every(v=>v.ok))process.exitCode=1;
