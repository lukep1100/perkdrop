const VERSION='v23-operations';
const CATALOGUE='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200';

module.exports=async function handler(req,res){
 let catalogue={ok:false,liveDrops:null,apiVersion:null};
 try{const r=await fetch(CATALOGUE,{headers:{accept:'application/json'}});if(r.ok){const body=await r.json();const deals=Array.isArray(body)?body:(body.deals||[]);catalogue={ok:true,liveDrops:deals.length,apiVersion:body.apiVersion||body.version||null}}}catch{}
 const ok=catalogue.ok;
 res.status(ok?200:503).setHeader('Cache-Control','no-store').json({ok,status:ok?'healthy':'degraded',service:'perkdrop',version:VERSION,environment:process.env.VERCEL_ENV||process.env.NODE_ENV||'production',catalogue,timestamp:new Date().toISOString()});
};
