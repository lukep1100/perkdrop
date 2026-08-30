const PORTAL_URL = 'https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-portal';
const MERCHANT_SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function getServerSideProps({ query, res }) {
  const merchant = typeof query.merchant === 'string' && MERCHANT_SLUG.test(query.merchant)
    ? query.merchant
    : '';
  const portalUrl = new URL(PORTAL_URL);
  if (merchant) portalUrl.searchParams.set('merchant', merchant);

  try {
    const upstream = await fetch(portalUrl, {
      headers: { Accept: 'text/html' },
    });
    if (!upstream.ok) throw new Error(`portal_status_${upstream.status}`);
    const html = await upstream.text();
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Robots-Tag', 'noindex');
    res.end(html);
  } catch {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.end('<!doctype html><title>PerkDrop</title><p>The claim portal is temporarily unavailable. Please return to PerkDrop and try again.</p>');
  }

  return { props: {} };
}

export default function ClaimPortal() {
  return null;
}
