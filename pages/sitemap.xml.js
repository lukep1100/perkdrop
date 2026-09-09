const API='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-catalogue-api?limit=200',SITE='https://perkdrop.au';
const routes=['/','/food','/drinks','/events','/free','/kids','/shopping','/weekend','/ending-soon','/near-me','/map','/business','/about','/terms','/privacy','/merchant-terms','/drop-terms','/verification','/affiliate','/contact'];
const x=v=>String(v).replace(/[<>&'\"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));
export async function getServerSideProps({res}){let drops=[];try{const r=await fetch(API,{headers:{accept:'application/json'}}),p=await r.json();drops=(Array.isArray(p)?p:p.deals||[]).filter(d=>d?.slug).map(d=>`/deals/${encodeURIComponent(d.slug)}`)}catch{}const urls=[...routes,...new Set(drops)].map(p=>`<url><loc>${x(SITE+p)}</loc></url>`).join('');res.setHeader('Content-Type','application/xml; charset=utf-8');res.setHeader('Cache-Control','public, s-maxage=3600, stale-while-revalidate=86400');res.end(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls}</urlset>`);return{props:{}}}export default function Sitemap(){return null}


