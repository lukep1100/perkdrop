import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { mobileHeaders, respond, tokenValid, hashSecret, readBody } from '../_shared/mobile-http.ts';
// Custom authentication: the secret device credential is verified by the existing
// marketplace identity service. Client-supplied consumer IDs are never trusted.
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: mobileHeaders });
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
  let body: Record<string, any>;
  try { body = await readBody(req); } catch { return respond({ error: 'invalid_request' }, 400); }
  const pushEnabled = Deno.env.get('PERKDROP_PUSH_ENABLED') === 'true' && !!Deno.env.get('EXPO_ACCESS_TOKEN');
  if (body.action === 'capabilities') return respond({ push_enabled: pushEnabled, account_deletion: true, policy_version: '2026-09-29' });
  const credential = req.headers.get('x-perkdrop-identity');
  if (!tokenValid(credential)) return respond({ error: 'identity_required' }, 401);
  try {
    const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
    const deviceHash = await hashSecret(credential);
    const address = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const { data: allowed, error: rateError } = await db.rpc('marketplace_rate_limit', { p_bucket: 'mobile:' + await hashSecret(address), p_max: 40, p_seconds: 60 });
    if (rateError) throw Error();
    if (!allowed) return respond({ error: 'rate_limited' }, 429);
    const { data: consumerId, error: identityError } = await db.rpc('marketplace_identity', { p_hash: deviceHash });
    if (identityError || !consumerId) return respond({ error: 'identity_unavailable' }, 401);
    if (body.action === 'push_status') {
      const { data, error } = await db.from('mobile_push_subscriptions').select('enabled,preferences,consent_at').eq('device_hash', deviceHash).eq('consumer_id', consumerId).maybeSingle();
      if (error) throw Error();
      return respond({ enabled: !!data?.enabled, preferences: data?.preferences || null, delivery_enabled: pushEnabled });
    }
    if (body.action === 'push_disable') {
      const { error } = await db.from('mobile_push_subscriptions').update({ enabled: false, updated_at: new Date().toISOString() }).eq('device_hash', deviceHash).eq('consumer_id', consumerId);
      if (error) throw Error();
      return respond({ ok: true });
    }
    if (body.action === 'push_register') {
      if (!pushEnabled) return respond({ error: 'notification_delivery_not_configured' }, 503);
      if (typeof body.token !== 'string' || !/^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$/.test(body.token) || !['ios','android'].includes(body.platform)) return respond({ error: 'invalid_registration' }, 400);
      const prefs = body.preferences || {};
      const city = String(prefs.city || '').toLowerCase(), timezone = String(prefs.timezone || '');
      if (!['adelaide','sydney','melbourne','brisbane','perth','darwin','canberra','hobart','gold-coast'].includes(city)) return respond({ error: 'invalid_city' }, 400);
      try { new Intl.DateTimeFormat('en-AU', { timeZone: timezone }); } catch { return respond({ error: 'invalid_timezone' }, 400); }
      const { error } = await db.rpc('mobile_register_push', { p_hash: deviceHash, p_token: body.token, p_platform: body.platform, p_preferences: {city,timezone} });
      if (error?.code === '23505') return respond({ error: 'device_token_already_registered' }, 409);
      if (error) throw Error();
      return respond({ ok: true, frequency: 'weekly' });
    }
    if (body.action === 'delete_account') {
      if (body.confirmation !== 'DELETE') return respond({ error: 'deletion_confirmation_required' }, 400);
      const { data, error } = await db.rpc('mobile_delete_consumer', { p_hash: deviceHash });
      if (error?.message?.includes('subscription_requires_cancellation')) return respond({ error: 'Cancel your paid subscription and contact support before deleting this account.' }, 409);
      if (error) throw Error();
      return respond(data);
    }
    return respond({ error: 'unknown_action' }, 400);
  } catch { return respond({ error: 'mobile_service_unavailable' }, 503); }
});
