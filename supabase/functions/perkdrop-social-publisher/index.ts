import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Retained so an existing deployment cannot silently become an auto-publisher.
// All new work is an owner-only private preview. Draft creation requires separate approval.
Deno.serve((req: Request) => new Response(JSON.stringify({
  ok: true,
  service: 'perkdrop-social-publisher',
  mode: 'disabled',
  message: 'Automatic social publishing is disabled. Owner approval is required in the private social publishing workspace.',
}), { status: req.method === 'GET' ? 200 : 409, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } }));
