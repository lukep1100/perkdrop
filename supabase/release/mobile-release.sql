-- Additive native-release services. Nothing schedules or sends a notification.
create table if not exists public.mobile_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  device_hash text not null unique check (device_hash ~ '^[a-f0-9]{64}$'),
  consumer_id uuid not null references public.marketplace_consumers(id) on delete cascade,
  expo_token text not null unique check (expo_token ~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$'),
  platform text not null check (platform in ('ios','android')),
  preferences jsonb not null,
  enabled boolean not null default true,
  consent_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_sent_at timestamptz
);
create table if not exists public.mobile_push_deliveries (
  id uuid primary key default gen_random_uuid(),
  subscription_id uuid not null references public.mobile_push_subscriptions(id) on delete cascade,
  catalogue_item_id text not null references public.catalogue_items(id) on delete cascade,
  campaign_key text not null check (campaign_key ~ '^[a-z0-9_-]{1,80}$'),
  status text not null default 'queued' check (status in ('queued','processing','ticketed','provider_accepted','failed','unknown','cancelled')),
  ticket_id text,
  error_code text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(subscription_id,campaign_key)
);
create index if not exists mobile_push_due_idx on public.mobile_push_deliveries(status,created_at);
alter table public.mobile_push_subscriptions enable row level security;
alter table public.mobile_push_deliveries enable row level security;
revoke all on public.mobile_push_subscriptions,public.mobile_push_deliveries from public,anon,authenticated;
grant select,insert,update,delete on public.mobile_push_subscriptions,public.mobile_push_deliveries to service_role;

create or replace function public.mobile_register_push(p_hash text,p_token text,p_platform text,p_preferences jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cid uuid; zone text; city text;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' or p_token is null or p_token !~ '^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]{10,200}\]$' or p_platform is null or p_platform not in ('ios','android') then raise exception 'invalid_push_registration'; end if;
  city:=p_preferences->>'city';zone:=p_preferences->>'timezone';
  if city is null or city not in ('adelaide','sydney','melbourne','brisbane','perth','darwin','canberra','hobart','gold-coast') then raise exception 'invalid_push_city';end if;
  if zone is null or not exists(select 1 from pg_catalog.pg_timezone_names where name=zone) then raise exception 'invalid_timezone';end if;
  cid:=public.marketplace_identity(p_hash);
  insert into public.mobile_push_subscriptions(device_hash,consumer_id,expo_token,platform,preferences)
  values(p_hash,cid,p_token,p_platform,jsonb_build_object('city',city,'timezone',zone,'frequency','weekly','quiet_start',20,'quiet_end',8,'daily_cap',1))
  on conflict(device_hash) do update set consumer_id=excluded.consumer_id,expo_token=excluded.expo_token,platform=excluded.platform,preferences=excluded.preferences,enabled=true,consent_at=now(),updated_at=now();
  return jsonb_build_object('ok',true);
end $$;

create or replace function public.mobile_claim_push(p_id uuid)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare d public.mobile_push_deliveries; s public.mobile_push_subscriptions; local_hour integer;
begin
  select * into d from public.mobile_push_deliveries where id=p_id for update;
  if not found or d.status<>'queued' or d.expires_at<=now() then return null;end if;
  select * into s from public.mobile_push_subscriptions where id=d.subscription_id for update;
  if not found or not s.enabled then return null;end if;
  local_hour:=extract(hour from now() at time zone (s.preferences->>'timezone'));
  if local_hour<8 or local_hour>=20 or (s.last_sent_at is not null and s.last_sent_at>now()-interval '7 days') then return null;end if;
  -- Reserve before network I/O: never automatically duplicate an unknown outcome.
  update public.mobile_push_subscriptions set last_sent_at=now(),updated_at=now() where id=s.id;
  update public.mobile_push_deliveries set status='processing',updated_at=now() where id=d.id;
  return jsonb_build_object('id',d.id,'subscription_id',s.id,'token',s.expo_token,'catalogue_item_id',d.catalogue_item_id,'expires_at',d.expires_at);
end $$;

create or replace function public.mobile_delete_consumer(p_hash text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare cid uuid; retained integer;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_identity';end if;
  cid:=public.marketplace_identity(p_hash);
  perform 1 from public.marketplace_consumers where id=cid for update;
  if exists(select 1 from public.consumer_memberships where consumer_id=cid and provider_subscription_id is not null and status in ('active','trialing','past_due')) then raise exception 'subscription_requires_cancellation';end if;
  delete from public.mobile_push_subscriptions where consumer_id=cid;
  delete from public.marketplace_outbox where consumer_id=cid;
  delete from public.marketplace_recovery where consumer_id=cid;
  delete from public.marketplace_watches where consumer_id=cid;
  delete from public.marketplace_saves where consumer_id=cid;
  delete from public.demand_signals where consumer_id=cid;
  delete from public.marketplace_device_links where consumer_id=cid;
  delete from public.marketplace_devices where consumer_id=cid;
  -- Retain transaction evidence, not account/session/bearer links or free-form PII.
  update public.redemptions set consumer_id=null,session_id=null,pass_reference=null,
    metadata=jsonb_strip_nulls(jsonb_build_object('offer_title',metadata->'offer_title','valid_from',metadata->'valid_from','valid_until',metadata->'valid_until','timezone',metadata->'timezone','inventory_unit',metadata->'inventory_unit','terms',metadata->'terms')),
    updated_at=now() where consumer_id=cid;
  get diagnostics retained=row_count;
  delete from public.marketplace_consumers where id=cid;
  return jsonb_build_object('deleted',true,'retained_transaction_records',retained);
end $$;
revoke all on function public.mobile_register_push(text,text,text,jsonb),public.mobile_claim_push(uuid),public.mobile_delete_consumer(text) from public,anon,authenticated;
grant execute on function public.mobile_register_push(text,text,text,jsonb),public.mobile_claim_push(uuid),public.mobile_delete_consumer(text) to service_role;
