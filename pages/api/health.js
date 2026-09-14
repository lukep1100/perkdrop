const VERSION='v30-marketplace-os',CATALOGUE='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200',TRANSIENT=new Set([408,429,500,502,503,504]);
async function fetchCatalogue(requestId){let lastError=null;for(let attempt=0;attempt<2;attempt++){try{const r=await fetch(CATALOGUE,{headers:{accept:'application/json','x-request-id':requestId},signal:AbortSignal.timeout(9000)});if(r.ok||!TRANSIENT.has(r.status)||attempt===1)return r;console.warn(JSON.stringify({msg:'catalogue_dependency_retry',route:'/api/health',requestId,attempt:attempt+1,upstreamStatus:r.status}));await r.arrayBuffer().catch(()=>{});}catch(error){lastError=error;if(attempt===1)throw error;console.warn(JSON.stringify({msg:'catalogue_dependency_retry',route:'/api/health',requestId,attempt:attempt+1,errorName:error?.name||'unknown'}));}await new Promise(resolve=>setTimeout(resolve,150));}throw lastError||new Error('catalogue_unavailable')}
function dependencyDiagnostics(response){
  const requestId=String(response.headers.get('x-perkdrop-request-id')||'').slice(0,180)||null;
  const failure=String(response.headers.get('x-perkdrop-query-failure')||'').slice(0,180)||null;
  const queryMs=String(response.headers.get('x-perkdrop-query-ms')||'').slice(0,24)||null;
  return {requestId,failure,queryMs};
}
module.exports=async function handler(req,res){
  const started=Date.now(),requestId=String(req.headers['x-vercel-id']||req.headers['x-request-id']||`health-${started}`).slice(0,180);
  let catalogue={ok:false,liveDrops:null,apiVersion:null,upstreamRequestId:null,upstreamFailure:null,upstreamQueryMs:null};
  try{
    const r=await fetchCatalogue(requestId),diagnostics=dependencyDiagnostics(r);
    if(diagnostics.requestId)res.setHeader('X-PerkDrop-Upstream-Request-Id',diagnostics.requestId);
    if(diagnostics.failure)res.setHeader('X-PerkDrop-Upstream-Failure',diagnostics.failure);
    if(diagnostics.queryMs)res.setHeader('X-PerkDrop-Upstream-Query-Ms',diagnostics.queryMs);
    if(!r.ok){
      catalogue={...catalogue,upstreamRequestId:diagnostics.requestId,upstreamFailure:diagnostics.failure,upstreamQueryMs:diagnostics.queryMs};
      console.warn(JSON.stringify({msg:'catalogue_dependency_failed',route:'/api/health',requestId,upstreamStatus:r.status,upstreamRequestId:diagnostics.requestId,upstreamFailure:diagnostics.failure,upstreamQueryMs:diagnostics.queryMs,ms:Date.now()-started}));
    }else{
      try{const b=await r.json(),deals=Array.isArray(b)?b:(b.deals||[]);catalogue={ok:true,liveDrops:deals.length,apiVersion:b.apiVersion||b.version||null,upstreamRequestId:diagnostics.requestId,upstreamFailure:null,upstreamQueryMs:diagnostics.queryMs};}
      catch(error){catalogue={...catalogue,upstreamRequestId:diagnostics.requestId,upstreamFailure:'invalid_json',upstreamQueryMs:diagnostics.queryMs};console.warn(JSON.stringify({msg:'catalogue_dependency_invalid_json',route:'/api/health',requestId,upstreamRequestId:diagnostics.requestId,ms:Date.now()-started,errorName:error?.name||'unknown'}));}
    }
  }catch(error){
    console.warn(JSON.stringify({msg:'catalogue_dependency_error',route:'/api/health',requestId,errorName:error?.name||'unknown',ms:Date.now()-started}));
  }
  const ok=catalogue.ok;
  res.status(ok?200:503).setHeader('Cache-Control','no-store').setHeader('X-PerkDrop-Request-Id',requestId).json({ok,status:ok?'healthy':'degraded',service:'perkdrop',version:VERSION,environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'production',catalogue,timestamp:new Date().toISOString()})
}
