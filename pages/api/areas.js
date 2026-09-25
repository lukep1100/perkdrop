import areas from '../../data/australian-areas.json';
export default function handler(req,res){
 if(req.method!=='GET'){res.setHeader('Allow','GET');return res.status(405).json({error:'method_not_allowed'});}
 const q=String(req.query.q||'').trim().toLowerCase().slice(0,80),state=String(req.query.state||'').toUpperCase();
 if(q.length<2)return res.status(200).json({areas:[]});
 const matches=areas.filter(a=>a[0].toLowerCase().includes(q)||a[1].startsWith(q));
 matches.sort((a,b)=>Number(b[2]===state)-Number(a[2]===state)||Number(b[0].toLowerCase()===q)-Number(a[0].toLowerCase()===q)||a[0].localeCompare(b[0]));
 res.setHeader('Cache-Control','public, max-age=86400, s-maxage=86400');
 return res.status(200).json({areas:matches.slice(0,30).map(a=>({name:a[0],postcode:a[1],state:a[2],lat:a[3],lng:a[4]})),source:'Matthew Proctor Australian Postcodes',approximate:true});
}
