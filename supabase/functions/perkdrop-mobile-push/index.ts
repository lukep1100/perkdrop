import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'npm:@supabase/supabase-js@2.57.4';
import { respond, sameSecret, readBody } from '../_shared/mobile-http.ts';
// Private, manually invoked sender. No cron, trigger or campaign is enabled.
// A ticket or provider receipt is NOT evidence that a person saw a notification.
Deno.serve(async req => {
  if (req.method !== 'POST') return respond({ error: 'method_not_allowed' }, 405);
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
  if (!await sameSecret(req.headers.get('authorization')?.replace(/^Bearer /,'') || '', secret)) return respond({ error: 'forbidden' }, 403);
  const expoAccess = Deno.env.get('EXPO_ACCESS_TOKEN');
  if (Deno.env.get('PERKDROP_PUSH_ENABLED') !== 'true' || !expoAccess) return respond({ error: 'push_delivery_disabled' }, 503);
  let body: Record<string, any>;
  try { body = await readBody(req); } catch { return respond({ error: 'invalid_request' }, 400); }
  const db = createClient(Deno.env.get('SUPABASE_URL')!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const value = async (query: any) => { const { data, error } = await query; if (error) throw Error('storage_error'); return data; };
  const finish = (id: string, status: string, extra: Record<string, any> = {}) => value(db.from('mobile_push_deliveries').update({status,...extra,updated_at:new Date().toISOString()}).eq('id',id));
  const provider = async (path: string, payload: unknown) => {
    const res = await fetch('https://exp.host/--/api/v2/push/'+path, {method:'POST',headers:{'Content-Type':'application/json','Authorization':'Bearer '+expoAccess},body:JSON.stringify(payload),signal:AbortSignal.timeout(10000)});
    if (!res.ok) throw Error('provider_unavailable');
    return await res.json();
  };
  async function currentEvent(id: string) {
    const visible = await value(db.rpc('marketplace_public_catalogue_items', {p_ids:[id]}));
    if (!visible?.some((row: any)=>row.id===id)) return null;
    const item=await value(db.from('catalogue_items').select('id,title,slug,city,kind,starts_at,ends_at,last_verified_at').eq('id',id).maybeSingle());
    const end=Date.parse(item?.ends_at), start=Date.parse(item?.starts_at), verified=Date.parse(item?.last_verified_at);
    if (item?.kind!=='event' || !/^[a-z0-9][a-z0-9_-]{0,239}$/i.test(item?.slug||'') || !Number.isFinite(start) || start>Date.now()+7*86400000 || !Number.isFinite(end) || end<=Date.now() || !Number.isFinite(verified) || verified>Date.now()+60000 || verified<Date.now()-7*86400000) return null;
    return item;
  }
  try {
    if (body.action === 'enqueue') {
      if (!/^[a-z0-9_-]{1,80}$/.test(body.campaign_key || '') || typeof body.item_id !== 'string') return respond({error:'invalid_campaign'},400);
      const item = await currentEvent(body.item_id);
      if (!item) return respond({error:'listing_needs_current_schedule_and_verification'},409);
      const end=Date.parse(item.ends_at);
      const city = String(item.city || '').toLowerCase().replaceAll(' ','-');
      const subscriptions = await value(db.from('mobile_push_subscriptions').select('id').eq('enabled',true).contains('preferences',{city}).limit(100));
      if (!subscriptions.length) return respond({queued:0});
      const expires = new Date(Math.min(end,Date.now()+86400000)).toISOString();
      const inserts = subscriptions.map((s: any)=>({subscription_id:s.id,catalogue_item_id:item.id,campaign_key:body.campaign_key,expires_at:expires}));
      const result = await value(db.from('mobile_push_deliveries').upsert(inserts,{onConflict:'subscription_id,campaign_key',ignoreDuplicates:true}).select('id'));
      return respond({queued:result.length});
    }
    if (body.action === 'dispatch') {
      const queued = await value(db.from('mobile_push_deliveries').select('id').eq('status','queued').gt('expires_at',new Date().toISOString()).order('created_at').limit(20));
      let ticketed=0,skipped=0,uncertain=0;
      for (const entry of queued) {
        const delivery = await value(db.rpc('mobile_claim_push',{p_id:entry.id}));
        if (!delivery) {skipped++;continue;}
        const item = await currentEvent(delivery.catalogue_item_id);
        const subscription=await value(db.from('mobile_push_subscriptions').select('enabled,preferences').eq('id',delivery.subscription_id).maybeSingle());
        const city=String(item?.city||'').toLowerCase().replaceAll(' ','-');
        const end=Date.parse(item?.ends_at);
        if (!item || !subscription?.enabled || subscription.preferences?.city!==city || Date.parse(delivery.expires_at)<=Date.now()) {await finish(entry.id,'cancelled',{error_code:'listing_or_consent_unavailable'});skipped++;continue;}
        try {
          const result=await provider('send',{to:delivery.token,title:'Your PerkDrop pick',body:String(item.title).slice(0,120)+' — check dates and booking requirements.',channelId:'perks',sound:null,ttl:Math.max(1,Math.floor((Math.min(end,Date.parse(delivery.expires_at))-Date.now())/1000)),data:{url:'https://perkdrop.au/deals/'+item.slug,expiresAt:new Date(Math.min(end,Date.parse(delivery.expires_at))).toISOString()}});
          const ticket=Array.isArray(result.data)?result.data[0]:result.data;
          if (ticket?.status==='ok' && ticket.id) {await finish(entry.id,'ticketed',{ticket_id:ticket.id});ticketed++;}
          else {
            const code=String(ticket?.details?.error||'provider_rejected').slice(0,80);
            await finish(entry.id,'failed',{error_code:code});
            if (code==='DeviceNotRegistered') await value(db.from('mobile_push_subscriptions').update({enabled:false}).eq('id',delivery.subscription_id));
          }
        } catch {
          await finish(entry.id,'unknown',{error_code:'provider_result_unknown'});uncertain++;
        }
      }
      return respond({ticketed,skipped,uncertain,receipt_check_required:true});
    }
    if (body.action === 'receipts') {
      const rows=await value(db.from('mobile_push_deliveries').select('id,ticket_id,subscription_id,updated_at').eq('status','ticketed').lt('updated_at',new Date(Date.now()-15*60000).toISOString()).limit(100));
      if (!rows.length) return respond({checked:0});
      const result=await provider('getReceipts',{ids:rows.map((r: any)=>r.ticket_id)});
      let checked=0;
      for (const row of rows) {
        const receipt=result.data?.[row.ticket_id];
        if (!receipt) {if(Date.parse(row.updated_at)<Date.now()-24*3600000)await finish(row.id,'unknown',{error_code:'receipt_expired'});continue;}
        checked++;
        const code=String(receipt.details?.error||'provider_rejected').slice(0,80);
        await finish(row.id,receipt.status==='ok'?'provider_accepted':'failed',receipt.status==='ok'?{}:{error_code:code});
        if(code==='DeviceNotRegistered')await value(db.from('mobile_push_subscriptions').update({enabled:false}).eq('id',row.subscription_id));
      }
      return respond({checked,meaning:'Provider receipt, not a confirmed handset view'});
    }
    return respond({error:'unknown_action'},400);
  } catch { return respond({error:'push_worker_unavailable'},503); }
});
