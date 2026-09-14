// Reproducible consumer-quality classification from scoped production snapshots.
// This generates reports and a reviewable SQL patch; it never writes to production.
import fs from 'node:fs/promises';
const read=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const {offers,businesses,sources}=await read('docs/data/consumer-review-inputs-2026-09-14.json');
await fs.mkdir('.audit/consumer',{recursive:true});
const decisions=await read('docs/data/consumer-offer-decisions-2026-09-14.json'),repairs=await read('docs/data/consumer-coordinate-repairs-2026-09-14.json');
const quote=x=>x==null?'null':"'"+String(x).replaceAll("'","''")+"'";
const json=x=>quote(JSON.stringify(x))+'::jsonb';
const plus30=x=>new Date(Date.parse(x)+30*86400000).toISOString().slice(0,10);
let sql='\n-- Reviewed consumer evidence, 14 September 2026. Original metadata and suppressed states preserved.\n';
const rows=decisions.map(d=>{
 const o=offers.find(x=>x.id===d.id),s=sources.find(x=>x.url===o.source);
 const checked=d.plan?.checkedAt||(d.plan?s?.checkedAt:null)||o.last_verified_at;
 const until=[plus30(checked),o.end_date,d.plan?.validUntil].filter(Boolean).sort()[0];
 const availability={reviewState:d.plan?'checked':d.grade==='D'?'conflicting':'unknown',checkedAt:checked,sourceUrl:d.plan?.sourceUrl||o.source,validFrom:d.plan?.validFrom||'2026-09-14',validUntil:until,windows:[],notes:d.note,...d.plan};
 // Source checked now only when its actual content was reviewed, not simply HTTP 200.
 if(d.id==='PD-2026-0031')availability.checkedAt='2026-09-14T09:42:52Z';
 let patch=`availability=${json(availability)},quality_grade=${quote(d.grade)},quality_note=${quote(d.note)}`;
 if(d.plan)patch+=`,last_verified_at=${quote(availability.checkedAt)}`;
 if(d.id==='PD-2026-0072')patch+=",price='Adult timed ticket $30'";
 if(d.id==='PD-2026-0057')patch+=",timing='Thu–Sun, 4:30pm–6:30pm',title='50% off selected drinks — Thu–Sun happy hour'";
 if(d.id==='PD-2026-0010')patch+=",timing='Daily, 10am–5pm; closed Good Friday and Christmas Day'";
 if(d.id==='PD-2026-0075')patch+=",title='Buy one main, get one free — confirm dates with venue',metadata=metadata- 'tonight_feature'";
 if(d.id==='PD-2026-0031')patch+=`,source=${quote(availability.sourceUrl)}`;
 sql+=`update public.catalogue_items set ${patch} where id=${quote(d.id)} and active;\n`;
 return {...d,title:o.title,source:availability.sourceUrl,lastChecked:availability.checkedAt,availability};
});
for(const r of repairs)sql+=`update public.merchants set latitude=${r.latitude},longitude=${r.longitude},primary_location=${quote(r.address)},metadata=coalesce(metadata,'{}')||${json({coordinate_review:{source:r.source,basis:r.basis,checked_at:'2026-09-14'}})} where id=${quote(r.id)} and (latitude is null or longitude is null) and permanent_listing and directory_status<>'removed';\n`;
const union=offers.find(x=>x.id.startsWith('UNION')),garden=offers.find(x=>x.id==='PD-2026-0005');
const photos=[{offer:union,url:union.metadata.static_image_url,rights:'merchant_authorised',basis:union.metadata.image_rights_note,source:union.metadata.image_source_url,caption:'Union Hotel exterior · merchant-authorised image'},{offer:garden,url:garden.image_url,rights:'licensed',basis:'CC0 1.0; Dinkum, own work, spring 2010. Existing offer asset; licence verified on Commons.',source:garden.metadata.image_source_url,caption:'Adelaide Botanic Garden entrance · Dinkum, 2010 · CC0'}];
for(const p of photos)sql+=`update public.merchants set hero_image_url=${quote(p.url)},image_rights_status=${quote(p.rights)},metadata=coalesce(metadata,'{}')||${json({hero_photo_provenance:{source:p.source,basis:p.basis,caption:p.caption,checked_at:'2026-09-14'}})} where id=${quote(p.offer.merchant_id)} and hero_image_url is null and permanent_listing and directory_status<>'removed';\n`;
const normalize=x=>String(x||'').toLowerCase().replace(/[^a-z0-9]/g,'');
const quality=businesses.map(b=>{
 const linked=rows.filter(o=>offers.find(x=>x.id===o.id).merchant_id===b.id),repair=repairs.find(x=>x.id===b.id),s=sources.find(x=>x.url===b.website_url),address=repair?.address||b.primary_location||'',photo=photos.some(p=>p.offer.merchant_id===b.id)||!!b.hero_image_url;
 const flags=[];if(!photo)flags.push('No rights-cleared hero');if(!linked.length)flags.push('No active offer');if(!/\d/.test(address))flags.push('Address absent or area-only');if(!b.business_category&&!b.venue_type)flags.push('Category missing');if(!b.website_url)flags.push('Website missing');if(s&&s.status!==200)flags.push('Website needs manual fetch review');
 if(b.name.length<3||/https?:|@|test|unknown/i.test(b.name))flags.push('Name needs review');
 const dup=businesses.filter(x=>x.id!==b.id&&normalize(x.name)===normalize(b.name)&&normalize(x.primary_location)===normalize(b.primary_location));if(dup.length)flags.push('Possible duplicate identity; do not merge automatically');
 const useful=linked.some(x=>['A','B'].includes(x.grade)),grade=useful?'A':flags.some(x=>/Address|duplicate|Website missing|Name|Category/.test(x))?'C':'B';
 return {id:b.id,name:b.name,city:b.primary_city,grade,address,activeOffers:linked.length,hasPhoto:photo,hasCoordinates:!!repair||(b.latitude!=null&&b.longitude!=null),website:b.website_url||'',flags:flags.join('; '),closedStatus:'Not independently established; no deletion',suburbStatus:repair?'Official address reviewed':'Not independently re-geocoded'};
});
const missing=businesses.filter(x=>x.latitude==null||x.longitude==null).map(b=>{
 const repair=repairs.find(x=>x.id===b.id);const s=sources.find(x=>x.url===b.website_url);
 const incomplete=!b.primary_location||!/\d/.test(b.primary_location)||/temporary|&|metropolitan|south australia|australia-wide/i.test(b.primary_location);
 let note=repair?repair.basis:incomplete?'Incomplete or multi-place record; establish exact venue/address before geocoding.':'Address stored; no confidently verified destination coordinate available from inspected source.';
 if(b.name==='Green Adelaide')note='Reject website agency GeoCoordinates: they identify Studio Veld, not Green Adelaide.';
 if(b.name==='Xenia Grill Main Beach')note='Reject generic site coordinates: they identify another branch near Coolangatta, not Main Beach.';
 if(['The Black Bull Hotel','Universal Bar','Hotel Darwin'].includes(b.name))note='Embedded map viewport coordinates are not independently verified destination pins.';
 return {id:b.id,name:b.name,city:b.primary_city,grade:repair?'A':incomplete?'C':'B',address:repair?.address||b.primary_location||'',website:b.website_url||'',sourceStatus:s?.status||s?.error||'No source',note};
});
const csv=rs=>{const keys=Object.keys(rs[0]);return [keys.map(quoteCSV).join(','),...rs.map(r=>keys.map(k=>quoteCSV(r[k])).join(','))].join('\n')+'\n';};
function quoteCSV(x){return '"'+String(x??'').replaceAll('"','""')+'"';}
await fs.writeFile('.audit/consumer/data.sql',sql);
await fs.writeFile('docs/data/consumer-business-quality-2026-09-14.csv',csv(quality));
await fs.writeFile('docs/data/consumer-missing-coordinates-2026-09-14.csv',csv(missing));
await fs.writeFile('docs/data/consumer-offer-quality-2026-09-14.csv',csv(rows.map(r=>({id:r.id,merchant:r.merchant,title:r.title,beforeGrade:r.beforeGrade,afterGrade:r.grade,note:r.note,source:r.source,lastChecked:r.lastChecked,serviceTimes:r.availability.label||'Not confirmed'}))));
await fs.writeFile('.audit/consumer/reviewed-offers.json',JSON.stringify(rows,null,2));
const count=(rs,k)=>rs.reduce((a,x)=>(a[x[k]]=(a[x[k]]||0)+1,a),{});
console.log(JSON.stringify({offers:count(rows,'grade'),beforeOffers:count(rows,'beforeGrade'),businesses:count(quality,'grade'),missingCoordinates:count(missing,'grade'),photos:photos.map(p=>({merchant:p.offer.merchant,source:p.source})),windows:rows.filter(x=>x.availability.windows.length).length},null,2));
