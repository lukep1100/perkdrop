// Project only the public fields needed to reproduce the dated quality reports.
// Never copy full merchant metadata, contacts, raw HTML, credentials or source snippets.
import fs from 'node:fs/promises';
const read=async name=>JSON.parse(await fs.readFile(`.audit/consumer/${name}.json`,'utf8'));
const pick=(row,keys)=>Object.fromEntries(keys.map(k=>[k,row[k]??null]));
const offers=(await read('offers')).map(o=>({...pick(o,['id','merchant_id','merchant','title','source','end_date','last_verified_at','image_url']),metadata:pick(o.metadata||{},['static_image_url','image_rights_note','image_source_url'])}));
const businesses=(await read('businesses')).map(b=>pick(b,['id','name','slug','primary_city','primary_location','business_category','venue_type','website_url','hero_image_url','latitude','longitude']));
const sources=(await read('source-checks')).map(s=>pick(s,['url','status','checkedAt','error']));
await fs.writeFile('docs/data/consumer-review-inputs-2026-09-14.json',JSON.stringify({offers,businesses,sources},null,2)+'\n');
console.log(JSON.stringify({offers:offers.length,businesses:businesses.length,sources:sources.length}));
