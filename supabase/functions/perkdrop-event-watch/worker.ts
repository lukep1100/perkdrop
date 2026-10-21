import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {createClient} from "npm:@supabase/supabase-js@2.57.4";
import {nextSourceCheck} from "../_shared/watch-retry.mjs";
import {parseStructuredEvents,normalizeEvent,nextOccurrences,eventLinks,safeUrl,cleanText} from "../_shared/event-ingestion.mjs";
const headers={'content-type':'application/json; charset=utf-8','cache-control':'no-store'};
const checked=async(q:any)=>{const r=await q;if(r.error)throw Error(r.error.message);return r;};
const stamp=()=>new Date().toISOString();
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(b=>b.toString(16).padStart(2,'0')).join('');}
async function fetchSource(url:string){
  if(!safeUrl(url,url))throw Error('invalid_source_url');
  for(let attempt=0;attempt<2;attempt++){
    const ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),9000);
    try{
      const r=await fetch(url,{redirect:'follow',signal:ctl.signal,headers:{'user-agent':'PerkDropEventWatch/3.0 (+https://perkdrop.au)',accept:'text/html,application/ld+json,application/json;q=0.9'}});
      if(!safeUrl(r.url,url)||new URL(r.url).hostname.replace(/^www\./,'')!==new URL(url).hostname.replace(/^www\./,''))throw Error('source_redirect_requires_review');
      return {ok:r.ok,status:r.status,body:(await r.text()).slice(0,3000000)};
    }catch(e){if(attempt||!/http2|connection reset|connection closed|error sending request/i.test(String(e)))throw e;await new Promise(r=>setTimeout(r,350));}finally{clearTimeout(timer);}
  }
  throw Error('source_fetch_failed');
}
Deno.serve(async req=>{
  const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,{auth:{persistSession:false,autoRefreshToken:false}});
  const {data:cfg}=await db.from('event_watch_config').select('*').eq('singleton',true).single();
  const reply=(data:any,status=200)=>new Response(JSON.stringify(data),{status,headers});
  if(!cfg||!req.headers.get('x-perkdrop-event-watch-secret')||req.headers.get('x-perkdrop-event-watch-secret')!==String(cfg.dispatch_secret))return reply({ok:false,error:'unauthorized'},401);
  if(!cfg.enabled)return reply({ok:true,enabled:false});
  const started=stamp(),out={ok:true,version:3,runId:null as number|null,sourcesChecked:0,sourcesChanged:0,eventsDetected:0,candidatesCreated:0,autoPublished:0,updated:0,withdrawn:0,sourcesDiscovered:0,duplicatesPrevented:0,failures:0},details:any[]=[];
  try{
    const run=await checked(db.from('event_watch_runs').insert({started_at:started,details:{version:3}}).select('id').single());out.runId=run.data.id;
    const sources=(await checked(db.from('merchant_sources').select('*').eq('monitoring_enabled',true).eq('authoritative',true).eq('purpose','deal_monitoring').or(`next_check_at.is.null,next_check_at.lte.${started}`).or('metadata->>pipeline.is.null,metadata->>pipeline.neq.profiled_event_watch').order('next_check_at',{ascending:true,nullsFirst:true}).limit(Math.min(Number(cfg.batch_size)||40,80)))).data;
    const ids=[...new Set(sources.map((s:any)=>s.merchant_id).filter(Boolean))];
    const merchants=ids.length?(await checked(db.from('merchants').select('id,name,primary_city,primary_state,primary_location,latitude,longitude').in('id',ids))).data:[];
    const merchantMap=new Map(merchants.map((m:any)=>[m.id,m]));
    const venues=(await checked(db.from('discovery_venues').select('address,state,latitude,longitude').not('latitude','is',null).limit(5000))).data;
    async function processSource(source:any){
      out.sourcesChecked++;
      try{
        const f=await fetchSource(source.source_url);
        if(!f.ok){const failures=Number(source.consecutive_failures||0)+1;await checked(db.from('merchant_sources').update({last_checked_at:stamp(),last_http_status:f.status,consecutive_failures:failures,next_check_at:nextSourceCheck({failures,status:f.status,intervalMinutes:cfg.interval_minutes}),updated_at:stamp()}).eq('id',source.id));out.failures++;details.push({source:source.id,status:f.status,error:'source_http_'+f.status});return;}
        const contentHash=await hash(f.body),changed=contentHash!==source.last_content_hash;if(changed)out.sourcesChanged++;
        await checked(db.from('merchant_sources').update({last_checked_at:stamp(),last_http_status:200,consecutive_failures:0,updated_at:stamp()}).eq('id',source.id));
        const pageTitle=cleanText(f.body.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1]||f.body.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1]||'');
        const parsed=parseStructuredEvents(f.body),path=new URL(source.source_url).pathname;
        const isDetail=/\/(?:events?|whats-on|whatson)\/[^/]+/i.test(path)&&!source.metadata?.discovery_feed;
        const existing=(await checked(db.from('deal_candidates').select('id,title,status,content_hash,published_drop_id,starts_at,metadata').eq('source_id',source.id).eq('candidate_type','event').limit(1000))).data;
        const normalized=nextOccurrences(parsed.map(raw=>normalizeEvent(raw,{...source,is_detail:isDetail,page_title:pageTitle},merchantMap.get(source.merchant_id)||{},Date.now(),venues)));
        for(const event of normalized){
          out.eventsDetected++;
          const canonical=event.metadata.event_url,eventHash=await hash(`${source.id}|${canonical}|${event.title.toLowerCase()}`);
          const matches=(c:any)=>c.metadata?.event_url===canonical&&c.title.toLowerCase()===event.title.toLowerCase();
          const prior=existing.find((c:any)=>c.published_drop_id&&matches(c))||existing.find((c:any)=>c.content_hash===eventHash||matches(c));
          if(event.unavailable){if(prior?.published_drop_id){await checked(db.from('catalogue_items').update({active:false,lifecycle_status:'withdrawn',updated_at:stamp(),metadata:{...prior.metadata,source_unavailable:true}}).eq('id',prior.published_drop_id));out.withdrawn++;await checked(db.from('deal_candidates').update({status:'needs_review',metadata:{...prior.metadata,...event.metadata,verification_issue:'source_unavailable'}}).eq('id',prior.id));}continue;}
          const row={title:event.title,summary:event.summary,starts_at:event.starts_at,ends_at:event.ends_at,price_text:event.price_text,merchant_id:source.merchant_id,source_id:source.id,source_url:source.source_url,market_id:null,candidate_type:'event',confidence:event.metadata.auto_publish_eligible?.99:.90,status:event.metadata.auto_publish_eligible?'new':'needs_review',content_hash:eventHash,metadata:{...event.metadata,source_checked_at:stamp(),source_content_hash:contentHash},updated_at:stamp()};
          if(prior){
            out.duplicatesPrevented++;
            if(prior.status==='rejected')continue;
            if(prior.published_drop_id){if(event.metadata.auto_publish_eligible){await checked(db.from('catalogue_items').update({title:event.title,description:event.summary,timing:event.metadata.timing,starts_at:event.starts_at,ends_at:event.ends_at,timezone:event.metadata.timezone,end_date:event.metadata.end_date,price:event.price_text,active:true,lifecycle_status:'active',last_verified_at:stamp(),schedule_verified_at:stamp(),updated_at:stamp()}).eq('id',prior.published_drop_id).eq('metadata->>auto_published','true').in('lifecycle_status',['active','expired']).or('metadata->>accuracy_hold.is.null,metadata->>accuracy_hold.neq.true'));await checked(db.from('deal_candidates').update({...row,status:prior.status,metadata:{...prior.metadata,...row.metadata}}).eq('id',prior.id));out.updated++;}}
            else if(prior.status!=='duplicate')await checked(db.from('deal_candidates').update({...row,metadata:{...prior.metadata,...row.metadata}}).eq('id',prior.id));
            continue;
          }
          const r=await db.from('deal_candidates').insert(row).select('id').single();if(r.error?.code==='23505'){out.duplicatesPrevented++;continue;}if(r.error)throw Error(r.error.message);out.candidatesCreated++;
        }
        // Related-event links on official detail pages also introduce new releases.
        // Each child is fetched and independently checked before it can publish.
        if(out.sourcesDiscovered<60){
          const links=eventLinks(f.body,source.source_url,10);
          if(links.length){const rows=links.map(url=>({merchant_id:source.merchant_id,source_url:url,purpose:'deal_monitoring',authoritative:true,monitoring_enabled:true,rights_status:'link_only',source_type:source.source_type,metadata:{discovered_from:source.source_url,discovered_by:'event-watch-v3'},next_check_at:stamp()}));const added=await checked(db.from('merchant_sources').upsert(rows,{onConflict:'merchant_id,source_url',ignoreDuplicates:true}).select('id'));out.sourcesDiscovered+=added.data?.length||0;}
        }
        await checked(db.from('merchant_sources').update({last_checked_at:stamp(),last_http_status:200,last_content_hash:contentHash,consecutive_failures:0,next_check_at:nextSourceCheck({intervalMinutes:Number(cfg.interval_minutes)||15}),updated_at:stamp()}).eq('id',source.id));
        details.push({source:source.id,status:200,changed,events:parsed.length});
      }catch(e){out.failures++;details.push({source:source.id,error:String(e).slice(0,250)});const failures=Number(source.consecutive_failures||0)+1;await db.from('merchant_sources').update({last_checked_at:stamp(),consecutive_failures:failures,next_check_at:nextSourceCheck({failures,status:0,intervalMinutes:cfg.interval_minutes}),updated_at:stamp()}).eq('id',source.id);}
    }
    for(let i=0;i<sources.length;i+=6)await Promise.all(sources.slice(i,i+6).map(processSource));
    out.autoPublished=(await checked(db.from('deal_candidates').select('id',{head:true,count:'exact'}).eq('status','published').gte('reviewed_at',started))).count||0;
  }catch(e){out.ok=false;out.failures++;details.push({error:String(e).slice(0,250)});}
  const finished=stamp();await db.from('event_watch_config').update({last_run_at:finished,last_result:out,updated_at:finished}).eq('singleton',true);
  if(out.runId)await db.from('event_watch_runs').update({finished_at:finished,sources_checked:out.sourcesChecked,sources_changed:out.sourcesChanged,events_detected:out.eventsDetected,candidates_created:out.candidatesCreated,auto_published:out.autoPublished,failures:out.failures,details:{version:3,result:out,sources:details}}).eq('id',out.runId);
  return reply(out,out.ok?200:500);
});
