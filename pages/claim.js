const PORTAL =
  "https://khzpdyyywiucfhubxkev.supabase.co/functions/v1/perkdrop-portal";
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const JOURNEY =
  '<div class="step"><span>1. Find your business</span><span>2. Sign in and confirm your role</span><span>3. PerkDrop verifies your access</span></div>';
export async function getServerSideProps({ query, res }) {
  const merchant =
    typeof query.merchant === "string" && SLUG.test(query.merchant)
      ? query.merchant
      : "";
  const u = new URL(PORTAL);
  if (merchant) u.searchParams.set("merchant", merchant);
  try {
    const r = await fetch(u, {
      headers: { Accept: "text/html", "X-PerkDrop-Portal-Proxy": "1" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!r.ok) throw Error("portal");
    let html = await r.text();
    html = html.replace(
      /<div class="step"><span>1\. Claim your business<\/span><span>2\. PerkDrop verifies access<\/span><span>3\. Create and control Drops<\/span><span>4\. Redeem codes \+ track customers<\/span><\/div>/,
      JOURNEY,
    );
    html = html.replace(
      "Create a Drop. Control the capacity.",
      "Claim your business.",
    );
    html = html.replace(
      "Claim your business for free, create genuine limited-time offers, choose the number of spots available and track customers PerkDrop sends you. Nothing goes live until it has been reviewed.",
      "Claiming is free. Confirm your role, then we verify your access. Create offers after approval.",
    );
    html = html.replace(
      "Redeem codes + track customers",
      "Manage your business after approval",
    );
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.end(html);
  } catch {
    res.statusCode = 502;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(
      '<!doctype html><html lang="en-AU"><meta name="viewport" content="width=device-width,initial-scale=1"><title>PerkDrop for Business</title><body style="margin:0;padding:24px;background:#08090e;color:#f5f6f8;font:18px/1.5 Arial,sans-serif"><main><h1>Please try again shortly</h1><p>The business portal is temporarily unavailable. Your details have not been submitted.</p><p><a href="" style="color:#ffce45">Try again</a> · <a href="/" style="color:#ffce45">Back to PerkDrop</a></p></main></body></html>',
    );
  }
  return { props: {} };
}
export default function Claim() {
  return null;
}
