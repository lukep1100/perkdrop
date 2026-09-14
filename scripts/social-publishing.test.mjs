import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {inspectPng,validateManifest,sha256,fetchPng,fingerprint,draftInput,assertDraft,EXPECTED_CHANNELS,MEDIA_BASE} from '../supabase/functions/_shared/social-publishing.mjs';
const originals=[
 ['01.png','19dda3a96d6fe4982a6db9930863990cd3a5685dcd796ccea27e499eb7e42c98',1538518],
 ['02.png','a9a9b13fb92ea4e7217971a4af9484ce3a7629a374263624da172ccd54f6f775',1083908],
 ['03.png','5843c63468dc94b2cf5f27d863c5751b43f45e3959022cf99b55051b234ab777',957757],
 ['04.png','21b97c8a69eed82bc91923d0ac780211fdb74c6b52d830cf71f05a43c1ca908b',1114112],
 ['05.png','8a4ccd07ebf9d72ce6d8aed880f0a1d6b3fc57631c84a42ae95b6ec338a935f5',1048413],
];
const assets=validateManifest(originals.map(([filename,sha256,byte_size])=>({filename,sha256,byte_size})));
for(const asset of assets)test('Exact original '+asset.filename+' is preserved and corruption is reported',async()=>{
 const bytes=await readFile(new URL('../public/social-media/'+asset.storage_path,import.meta.url));
 assert.equal(bytes.length,asset.byte_size);assert.equal(await sha256(bytes),asset.sha256);
 if(asset.order===4)assert.throws(()=>inspectPng(bytes),/Truncated PNG/);
 else assert.deepEqual(inspectPng(bytes),{width:1080,height:1080,byte_size:bytes.length,mime_type:'image/png'});
});
test('Manifest rejects wrong count, duplicate slides and unsupported data',()=>{
 assert.throws(()=>validateManifest([]));assert.throws(()=>validateManifest(Array(5).fill(assets[0])));
 assert.throws(()=>validateManifest(assets.map(a=>({...a,byte_size:9000000}))));
 assert.throws(()=>validateManifest(assets.map(a=>({...a,sha256:'bad'}))));
});
test('Hosted verification validates PNG content, exact bytes and destination',async()=>{
 const asset=assets[0],bytes=await readFile(new URL('../public/social-media/'+asset.storage_path,import.meta.url));
 const fetcher=async()=>new Response(bytes,{headers:{'content-type':'image/png'}});
 assert.equal((await fetchPng(asset,fetcher)).sha256,asset.sha256);
 await assert.rejects(fetchPng({...asset,public_url:'https://evil.test/image.png'},fetcher),/Untrusted/);
 await assert.rejects(fetchPng(asset,async()=>new Response(bytes,{headers:{'content-type':'text/html'}})),/not image/);
 await assert.rejects(fetchPng(asset,async()=>new Response(null,{status:404})),/HTTP 404/);
 await assert.rejects(fetchPng({...asset,byte_size:1},fetcher),/differ/);
 const broken=await readFile(new URL('../public/social-media/'+assets[3].storage_path,import.meta.url));
 await assert.rejects(fetchPng(assets[3],async()=>new Response(broken,{headers:{'content-type':'image/png'}})),/Truncated/);
});
test('Draft input cannot schedule, share now, add TikTok, or lose slide order',()=>{
 const job={caption:'Approved exact caption',assets,channels:['instagram','facebook']};
 for(const platform of job.channels){
   const channel={platform,...EXPECTED_CHANNELS[platform]},input=draftInput(job,channel);
   assert.equal(input.saveToDraft,true);assert.equal(input.mode,'addToQueue');
   assert.equal(input.dueAt,undefined);assert.equal(input.scheduledAt,undefined);
   assert.deepEqual(input.assets.map(a=>a.image.url),assets.map(a=>a.public_url));
   assertDraft({id:'post',status:'draft',text:job.caption,channelId:channel.id,assets:assets.map(a=>({source:a.public_url,mimeType:'image/png'}))},job,channel);
   assert.throws(()=>assertDraft({id:'post',status:'scheduled'},job,channel));
 }
 assert.throws(()=>draftInput(job,{platform:'tiktok',id:'other'}));
});
test('Approval fingerprint changes with any caption, channel or asset change',async()=>{
 const job={caption:'Exact',channels:['instagram','facebook'],assets};
 const original=await fingerprint(job);
 assert.equal(await fingerprint({...job,assets:assets.map(a=>Object.fromEntries(Object.entries(a).reverse()))}),original);
 assert.notEqual(await fingerprint({...job,caption:'Different'}),original);
 assert.notEqual(await fingerprint({...job,channels:['facebook']}),original);
 assert.notEqual(await fingerprint({...job,assets:[...assets].reverse()}),original);
 assert.ok(assets.every(a=>a.public_url===MEDIA_BASE+a.sha256+'.png'));
});
