export const MARKETPLACE_API='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-marketplace';
export const IDENTITY_KEY='perkdrop_consumer_credential_v1';
export function newCredential(){return Array.from(crypto.getRandomValues(new Uint8Array(32))).map(x=>x.toString(16).padStart(2,'0')).join('');}
export function credential(){
  let value=localStorage.getItem(IDENTITY_KEY);
  if(!/^[a-f0-9]{64}$/.test(value||'')){value=newCredential();localStorage.setItem(IDENTITY_KEY,value);}
  return value;
}
export async function marketplace(action,body={}){
  const response=await fetch(MARKETPLACE_API,{method:'POST',cache:'no-store',headers:{'content-type':'application/json','x-perkdrop-identity':credential()},body:JSON.stringify({action,...body})});
  const data=await response.json();
  if(!response.ok)throw new Error(String(data.error||'Request failed').replaceAll('_',' '));
  return data;
}
export function passState(pass){return pass.status==='created'?(pass.expires_at&&new Date(pass.expires_at)<=new Date()?'expired':'active'):pass.status;}
export function units(unit,quantity){
  const names={diner:['diner','diners'],person:['participant','participants'],ticket:['ticket','tickets'],appointment:['appointment','appointments'],booking:['booking','bookings'],tee_time:['player','players'],class_spot:['class spot','class spots'],room:['room','rooms'],item:['item','items'],package:['package','packages']};
  return `${quantity} ${(names[unit]||['unit','units'])[Number(quantity)===1?0:1]}`;
}
