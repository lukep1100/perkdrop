// Anonymous browser identity and a visit renewed after 30 minutes of inactivity.
export function analyticsContext(now=Date.now()){
 const fresh=()=>crypto.randomUUID();
 try{
  const params=new URLSearchParams(location.search);
  if(params.get('traffic')==='internal')localStorage.setItem('perkdrop_internal_traffic','1');
  if(params.get('traffic')==='public')localStorage.removeItem('perkdrop_internal_traffic');
  let visitorId=localStorage.getItem('perkdrop_visitor_v2');if(!visitorId){visitorId=fresh();localStorage.setItem('perkdrop_visitor_v2',visitorId);}
  let visit=JSON.parse(localStorage.getItem('perkdrop_visit_v2')||'null');
  if(!visit||!visit.id||now-visit.last>30*60000||visit.last>now)visit={id:fresh()};
  visit.last=now;localStorage.setItem('perkdrop_visit_v2',JSON.stringify(visit));
  return {visitorId,sessionId:visit.id,internal:localStorage.getItem('perkdrop_internal_traffic')==='1'||location.hostname.endsWith('.vercel.app')||location.hostname==='localhost'};
 }catch{return {visitorId:null,sessionId:null,internal:false};}
}
export function trackAction(event_type,metadata={}){
 const c=analyticsContext();return fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-track',{method:'POST',headers:{'content-type':'application/json'},keepalive:true,body:JSON.stringify({event_type,session_id:c.sessionId,source_page:location.pathname,metadata:{...metadata,path:location.pathname,visitor_id:c.visitorId,traffic_type:c.internal?'internal':'public',platform:'web'}})}).catch(()=>{});
}
