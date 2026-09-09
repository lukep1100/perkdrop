import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
const OFFER_ID='5f1a5ca3-30ba-4747-869a-0a60edb596c7';
const DROP_ID='UNION-HOTEL-LUNCH-20-OFF';
const METRICS_TRUSTWORTHY_SINCE='2026-09-09T06:37:25Z';
const allowed=(o:string)=>{try{const h=new URL(o).host;return h==='perkdrop.au'||h==='www.perkdrop.au'||(h.includes('perkdrop')&&h.endsWith('.vercel.app'))}catch{return false}};
const response=(req:Request,b:unknown,s=200)=>{const o=req.headers.get('origin')||'';return new Response(JSON.stringify(b),{status:s,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','access-control-allow-origin':allowed(o)?o:'https://perkdrop.au','access-control-allow-headers':'authorization, content-type','access-control-allow-methods':'GET, OPTIONS','vary':'Origin'}})};
const localNow=(tz='Australia/Adelaide')=>{const p=new Intl.DateTimeFormat('en-AU',{timeZone:tz,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date());const m:any={};for(const x of p)m[x.type]=x.value;return{date:`${m.year}-${m.month}-${m.day}`,minutes:Number(m.hour)*60+Number(m.minute)}};
const mins=(v:any)=>{const [h,m]=String(v||'00:00').split(':').map(Number);return(h||0)*60+(m||0)};
const money=(n:number)=>Math.round(n*100)/100;
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return response(req,{ok:true},204);
 if(req.method!=='GET')return response(req,{error:'method_not_allowed'},405);
 const o=req.headers.get('origin')||'';if(o&&!allowed(o))return response(req,{error:'origin_not_allowed'},403);
 const url=Deno.env.get('SUPABASE_URL')!,token=req.headers.get('authorization')||'';
 const auth=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')!,{global:{headers:{Authorization:token}}});
 const {data:{user}}=await auth.auth.getUser();if(!user)return response(req,{error:'unauthorized'},401);
 const admin=createClient(url,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
 const {data:owner}=await admin.from('admin_users').select('user_id').eq('user_id',user.id).maybeSingle();if(!owner)return response(req,{error:'forbidden'},403);
 const days=Math.min(90,Math.max(1,Number(new URL(req.url).searchParams.get('days')||7)));const since=new Date(Date.now()-days*86400000).toISOString();
 await admin.rpc('reconcile_expired_booking_allocations');
 const [er,rr,sr,hr]=await Promise.all([
  admin.from('engagement_events').select('event_type,session_id,metadata,created_at').eq('merchant_offer_id',OFFER_ID).gte('created_at',since).order('created_at',{ascending:true}).limit(20000),
  admin.from('redemptions').select('id,status,party_size,session_id,gross_value,discount_value,commission_value,created_at,redeemed_at,metadata').eq('merchant_offer_id',OFFER_ID).gte('created_at',since).limit(10000),
  admin.from('offer_sessions').select('id,service_date,timezone,service_start,service_end,capacity_total,capacity_remaining,status').eq('merchant_offer_id',OFFER_ID).order('service_date',{ascending:true}).limit(100),
  admin.from('booking_claim_holds').select('id,status,party_size,session_id,created_at,expires_at,confirmed_at,released_at,metadata').eq('merchant_offer_id',OFFER_ID).gte('created_at',since).limit(10000)
 ]);
 const bad=[er,rr,sr,hr].find(x=>x.error)?.error;if(bad)return response(req,{error:'analytics_unavailable'},500);
 const events=er.data||[],reds=rr.data||[],sessions=sr.data||[],holds=hr.data||[];
 const paid=(x:any)=>String(x?.metadata?.utm_source||'').toLowerCase()==='meta'&&String(x?.metadata?.utm_medium||'').toLowerCase()==='paid_social';
 const paidEvents=events.filter(paid),paidSessions=new Set(paidEvents.map((x:any)=>x.session_id).filter(Boolean));
 const ec=(name:string)=>paidEvents.filter((x:any)=>x.event_type===name).length;
 const uniqueFor=(name:string)=>new Set(paidEvents.filter((x:any)=>x.event_type===name).map((x:any)=>x.session_id).filter(Boolean)).size;
 const paidReds=reds.filter((r:any)=>{const a=r.metadata?.attribution||{};return String(a.utm_source||'').toLowerCase()==='meta'&&String(a.utm_medium||'').toLowerCase()==='paid_social'});
 const claimsIssued=paidReds.filter((r:any)=>['created','redeemed','expired'].includes(r.status));
 const confirmed=paidReds.filter((r:any)=>r.status==='redeemed');
 const dinersClaimed=claimsIssued.reduce((n:number,r:any)=>n+Math.max(1,Number(r.party_size)||1),0);
 const confirmedDiners=confirmed.reduce((n:number,r:any)=>n+Math.max(1,Number(r.party_size)||1),0);
 const trackedGrossValue=money(confirmed.reduce((n:number,r:any)=>n+Number(r.gross_value||0),0));
 const trackedDiscountValue=money(confirmed.reduce((n:number,r:any)=>n+Number(r.discount_value||0),0));
 const perkDropFees=money(confirmed.reduce((n:number,r:any)=>n+Number(r.commission_value||0),0));
 const avgTrackedSpendPerDiner=confirmedDiners>0?money(trackedGrossValue/confirmedDiners):0;
 const upcoming=sessions.filter((s:any)=>{const n=localNow(s.timezone||'Australia/Adelaide');return String(s.service_date)>n.date||(String(s.service_date)===n.date&&mins(s.service_end)>n.minutes)});
 const next=upcoming.find((s:any)=>s.status==='active'&&Number(s.capacity_remaining)>0)||upcoming.find((s:any)=>s.status==='active')||null;
 const sourceMap=new Map<string,Set<string>>();for(const e of events){const src=String(e.metadata?.utm_source||'direct').toLowerCase()||'direct';const key=src==='meta'&&String(e.metadata?.utm_medium||'').toLowerCase()==='paid_social'?'Meta paid':src==='facebook'||src==='instagram'||src==='tiktok'?'Organic social':src==='direct'?'Direct':src==='referral'?'Referral':'Other';if(!sourceMap.has(key))sourceMap.set(key,new Set());if(e.session_id)sourceMap.get(key)!.add(e.session_id)}
 const ratio=(a:number,b:number)=>b>0?Math.round(a/b*1000)/10:0;
 return response(req,{ok:true,days,generatedAt:new Date().toISOString(),metricsTrustworthySince:METRICS_TRUSTWORTHY_SINCE,historicalNote:'Paid landing and deal-view history existed before the funnel upgrade. Service selection, hold, booking-click, confirmed-claim and spend metrics are trustworthy only from their respective instrumentation deployment times forward.',unionMeta:{paidSessions:paidSessions.size,dealViews:uniqueFor('deal_view'),paidLandings:uniqueFor('paid_landing'),serviceSelections:ec('service_date_selected'),partySelections:ec('party_size_selected'),claimStarts:ec('claim_started'),holdsCreated:ec('hold_created'),claimsIssued:claimsIssued.length,dinersClaimed,bookTableClicks:ec('book_table_clicked'),confirmedRedemptions:confirmed.length,confirmedDiners,trackedGrossValue,trackedDiscountValue,avgTrackedSpendPerDiner,perkDropFees,sessionToClaimPct:ratio(claimsIssued.length,paidSessions.size),claimToBookPct:ratio(ec('book_table_clicked'),claimsIssued.length),paidSessionToConfirmedPct:ratio(confirmed.length,paidSessions.size)},nextService:next?{id:next.id,serviceDate:next.service_date,timezone:next.timezone,serviceStart:String(next.service_start).slice(0,5),serviceEnd:String(next.service_end).slice(0,5),capacityTotal:Number(next.capacity_total),capacityRemaining:Number(next.capacity_remaining),soldOut:Number(next.capacity_remaining)<=0}:null,upcomingServices:upcoming.filter((s:any)=>s.status==='active').slice(0,8).map((s:any)=>({serviceDate:s.service_date,capacityTotal:Number(s.capacity_total),capacityRemaining:Number(s.capacity_remaining),serviceStart:String(s.service_start).slice(0,5),serviceEnd:String(s.service_end).slice(0,5)})),sourceSessions:Array.from(sourceMap.entries()).map(([source,set])=>({source,sessions:set.size})).sort((a,b)=>b.sessions-a.sessions),holds:{active:holds.filter((h:any)=>h.status==='held'&&new Date(h.expires_at)>new Date()).length,expired:holds.filter((h:any)=>h.status==='expired').length,confirmed:holds.filter((h:any)=>h.status==='confirmed').length},dropId:DROP_ID},200);
});
