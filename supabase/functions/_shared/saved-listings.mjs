export function resolveSavedListings(saves,drops,merchants){
  const byDrop=new Map(drops.map(d=>[String(d.id),d]));
  const byMerchant=new Map(merchants.map(m=>[String(m.id),m]));
  return saves.map(s=>{
    const item=s.kind==='drop'?byDrop.get(s.target):byMerchant.get(s.target);
    const visible=item&&(s.kind==='drop'||item.permanent_listing&&item.directory_status!=='removed');
    return {...s,label:visible?(s.kind==='drop'?item.merchant+' — '+item.title:item.name):'Saved listing unavailable',href:visible&&item.slug?'/'+(s.kind==='drop'?'deals':'venues')+'/'+encodeURIComponent(item.slug):null};
  });
}
