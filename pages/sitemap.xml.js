const API='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200';
const SITE='https://perkdrop.au';
const routes=['/','/food','/drinks','/events','/free','/shopping','/weekend','/ending-soon','/near-me','/map','/business','/terms','/privacy','/merchant-terms','/drop-terms','/verification','/affiliate','/contact'];
const escapeXml=value=>String(value).replace(/[<>&'\"]/g,char=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[char]));

export async function getServerSideProps({res}){
 let drops=[];
 try{const response=await fetch(API,{headers:{accept:'application/json'}});const payload=await response.json();drops=(Array.isArray(payload)?payload:payload.deals||[]).filter(drop=>drop?.slug).map(drop=>`/deals/${encodeURIComponent(drop.slug)}`)}catch{}
 const urls=[...routes,...new Set(drops)].map(path=>`<url><loc>${escapeXml(SITE+path)}</loc></url>`).join('');
 res.setHeader('Content-Type','application/xml; charset=utf-8');
 res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');
 res.write(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);
 res.end();
 return {props:{}};
}
export default function Sitemap(){return null}
