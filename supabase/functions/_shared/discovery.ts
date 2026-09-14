export const isAustralianPoint = (lat: unknown, lng: unknown) => lat !== null && lat !== '' && lng !== null && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Number(lat)>=-44 && Number(lat)<=-10 && Number(lng)>=112 && Number(lng)<=154;
export function localDay(state: string, now=new Date()) {
  const zone=({SA:'Australia/Adelaide',NT:'Australia/Darwin',WA:'Australia/Perth',QLD:'Australia/Brisbane',NSW:'Australia/Sydney',ACT:'Australia/Sydney',VIC:'Australia/Melbourne',TAS:'Australia/Hobart'} as Record<string,string>)[state]||'Australia/Sydney';
  const p=Object.fromEntries(new Intl.DateTimeFormat('en-AU',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${p.year}-${p.month}-${p.day}`;
}
export function approvedImage(value: unknown) {
  try {const u=new URL(String(value||''));return u.protocol==='https:'&&!/(^|\.)unsplash\.com$/i.test(u.hostname)?u.href:'';} catch{return '';}
}
export function directoryVisible(m: any) {return Boolean(m)&&m.permanent_listing===true&&m.directory_status!=='removed';}
export const categoryVertical=(category: string)=>({food:'food','food & drink':'food',drinks:'drinks',events:'events',experiences:'experiences',shopping:'shopping',freebies:'free',beauty:'beauty',wellness:'wellness',hair:'hair',fitness:'fitness',activities:'activities',golf:'golf',tourism:'tourism',stay:'stay',services:'services'} as Record<string,string>)[String(category||'').toLowerCase()]||'other';
