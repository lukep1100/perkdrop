module.exports=async function handler(req,res){
 let catalogueOk=false,liveDrops=null;
 try{
  const r=await fetch("https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200");
  if(r.ok){const j=await r.json();const d=Array.isArray(j)?j:(j.deals||[]);catalogueOk=true;liveDrops=d.length}
 }catch{}
 res.status(200).json({ok:true,service:"perkdrop",version:"v20-business-status",catalogueOk,liveDrops});
};