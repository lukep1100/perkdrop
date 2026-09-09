const PORTAL='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-portal';
const SLUG=/^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export async function getServerSideProps({query,res}){const merchant=typeof query.merchant==='string'&&SLUG.test(query.merchant)?query.merchant:'';const u=new URL(PORTAL);if(merchant)u.searchParams.set('merchant',merchant);try{const r=await fetch(u,{headers:{Accept:'text/html','X-PerkDrop-Portal-Proxy':'1'},cache:'no-store'});if(!r.ok)throw Error('portal');let html=await r.text();html=html.replace('<div class="toplinks">','<div class="toplinks"><a class="pill" href="/merchant-floor">Floor tool</a>');res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(html)}catch{res.statusCode=502;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.end('<!doctype html><title>PerkDrop</title><p>The business portal is temporarily unavailable. Please try again.</p>')}return{props:{}}}
export default function Claim(){return null}


