import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const UPSTREAM='https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-booking-page';

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') return new Response('Method not allowed', { status: 405 });
  const u = new URL(req.url);
  const qs = new URLSearchParams();
  for (const key of ['offer','drop','party']) {
    const v = u.searchParams.get(key);
    if (v) qs.set(key, v);
  }
  const upstream = await fetch(`${UPSTREAM}?${qs.toString()}`, { headers: { accept: 'text/html' }, redirect: 'follow', cache: 'no-store' });
  const html = await upstream.text();
  if (!upstream.ok || !/^\s*<!doctype html>/i.test(html)) return new Response('Preview unavailable', { status: 502, headers: new Headers([['Content-Type','text/plain; charset=UTF-8']]) });
  return new Response(html, { status: 200, headers: new Headers([
    ['Content-Type','text/html; charset=UTF-8'],
    ['Content-Disposition','inline'],
    ['Cache-Control','no-store, no-cache, must-revalidate, max-age=0'],
    ['Pragma','no-cache'],
    ['X-Robots-Tag','noindex, nofollow'],
    ['Referrer-Policy','strict-origin-when-cross-origin']
  ]) });
});
