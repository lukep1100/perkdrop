// Token-bearing page: no analytics, prefetching or third-party resources.
export async function getServerSideProps({req,res,query}) {
  const token=typeof query.token==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(query.token)?query.token:'';
  let title='Stop PerkDrop marketing',message='Confirm below to stop marketing emails. Under PerkDrop’s publication policy, the business linked to this email will also be removed from public listings. Existing private booking records are retained.',status=200,form=Boolean(token);
  if(!token){title='Invalid unsubscribe link';message='Reply to your PerkDrop email asking to unsubscribe, or contact perkdropofficial@gmail.com.';status=400;}
  else if(req.method==='POST'){
    try{
      const r=await fetch('https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-unsubscribe',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({token}),cache:'no-store',signal:AbortSignal.timeout(12000)});
      const j=await r.json();if(!r.ok||!j.ok)throw Error(r.status===404?'invalid':'retry');
      title='Unsubscribed';message='Marketing is suppressed for this business. Its public listing and offers have been removed under PerkDrop’s publication policy. This does not cancel existing bookings or remove external search-engine copies.';form=false;
    }catch(e){title=e.message==='invalid'?'Link not found':'Please try again';message='The request could not be confirmed. Reply “unsubscribe” to your PerkDrop email for manual help.';status=e.message==='invalid'?404:503;}
  }else if(req.method!=='GET'&&req.method!=='HEAD'){status=405;form=false;}
  res.statusCode=status;res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');res.setHeader('X-Robots-Tag','noindex, nofollow');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'");
  res.end(`<!doctype html><html lang="en-AU"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${title}</title><style>body{background:#08090e;color:#f5f6f8;font:18px/1.6 Arial;margin:0}main{max-width:580px;margin:40px auto;padding:24px}button{padding:14px 18px;background:#aa126d;color:white;border:0;border-radius:12px;font:inherit;min-height:44px}a{color:#ffce45}</style></head><body><main><h1>${title}</h1><p>${message}</p>${form?'<form method="post"><button type="submit">Confirm unsubscribe</button></form>':''}<p><a href="/">Back to PerkDrop</a></p></main></body></html>`);
  return {props:{}};
}
export default function Unsubscribe(){return null;}
