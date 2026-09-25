// Branch identity is independent of offer and coordinate corrections.
const part=v=>String(v||'').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
export function venueKey(d){
  if(d.venueId)return String(d.venueId);
  if(d.locationId)return `branch:${d.locationId}`;
  const name=part(d.merchant||d.name),address=part(d.location||d.address),state=part(d.state||d.city);
  return `${name}|${address||state}`;
}
export function legacyVenueKey(d){
 const name=part(d.merchantId)||part(d.merchantSlug)||part(d.merchant)||part(d.title);
 const coordinates=d.latitude!=null&&d.longitude!=null?`${Number(d.latitude).toFixed(4)},${Number(d.longitude).toFixed(4)}`:'';
 return `${name}|${coordinates||part(d.location||d.locationName)||part(d.city)}`;
}
