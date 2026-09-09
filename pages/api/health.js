const VERSION='v24-live-funnel',CATALOGUE='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200';
module.exports=async function handler(req,res){let catalogue={ok:false,liveDrops:null,apiVersion:null};try{const r=await fetch(CATALOGUE,{headers:{accept:'application/json'}});if(r.ok){const b=await r.json(),deals=Array.isArray(b)?b:(b.deals||[]);catalogue={ok:true,liveDrops:deals.length,apiVersion:b.apiVersion||b.version||null}}}catch{}const ok=catalogue.ok;res.status(ok?200:503).setHeader('Cache-Control','no-store').json({ok,status:ok?'healthy':'degraded',service:'perkdrop',version:VERSION,environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'production',catalogue,timestamp:new Date().toISOString()})}


