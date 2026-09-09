const FLOOR='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-merchant-floor';
export async function getServerSideProps({res}){try{const r=await fetch(FLOOR,{headers:{Accept:'text/html'},cache:'no-store'});if(!r.ok)throw Error('floor');let html=await r.text();html=html.replace('<span class="pill">STAFF FLOOR</span>','<span><a href="/claim" style="color:#cbb7ff;text-decoration:none;font-size:10px;font-weight:900;margin-right:8px">BUSINESS PORTAL</a><span class="pill">STAFF FLOOR</span></span>');res.statusCode=200;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Robots-Tag','noindex, nofollow');res.end(html)}catch{res.statusCode=502;res.end('PerkDrop merchant floor is temporarily unavailable.')}return{props:{}}}
export default function MerchantFloor(){return null}


