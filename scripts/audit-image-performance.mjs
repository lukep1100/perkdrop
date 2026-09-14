import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('sharp');
const base=process.env.SMOKE_BASE_URL||'http://localhost:3100';
const baseline=JSON.parse(await readFile(new URL('../.audit/product-baseline/summary.json',import.meta.url),'utf8'));
const selected=baseline.images.filter(i=>i.url.includes('datocms-assets.com/88015/')||i.url.includes('hota.com.au/uploads/')||i.url.includes('perkdrop-union-slideshow'));
const results=[];
for(const before of selected){
 const source=before.url.includes('perkdrop-union-slideshow')?before.url.split('?')[0]+'?still=1':before.url;
 const url=base+'/_next/image?url='+encodeURIComponent(source)+'&w=828&q=75';
 const r=await fetch(url,{headers:{accept:'image/webp'},signal:AbortSignal.timeout(30000)});
 const bytes=Buffer.from(await r.arrayBuffer());
 if(!r.ok)throw Error('Image optimizer returned '+r.status+' for '+new URL(source).hostname);
 const metadata=await sharp(bytes).metadata();await sharp(bytes).raw().toBuffer();
 const result={source,status:r.status,type:r.headers.get('content-type'),beforeBytes:before.bytes,afterBytes:bytes.length,reductionPercent:Math.round((1-bytes.length/before.bytes)*1000)/10,width:metadata.width,height:metadata.height};
 results.push(result);console.log(JSON.stringify(result));
}
await mkdir('.audit/product-after',{recursive:true});await writeFile('.audit/product-after/image-performance-'+new URL(base).hostname+'.json',JSON.stringify({base,checkedAt:new Date().toISOString(),results},null,2));
