-- Candidate release: private anonymous identity and existing redemption lifecycle.
create table public.marketplace_consumers (
  id uuid primary key default gen_random_uuid(),
  credential_hash text not null unique check(credential_hash ~ '^[a-f0-9]{64}$'),
  email text,
  email_verified_at timestamptz,
  preferences jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.marketplace_consumers enable row level security;
revoke all on public.marketplace_consumers from public,anon,authenticated;
grant select,insert,update on public.marketplace_consumers to service_role;

alter table public.redemptions add column consumer_id uuid references public.marketplace_consumers(id);
alter table public.redemptions add column pass_reference text unique;
alter table public.redemptions add constraint redemption_pass_entropy check(pass_reference is null or pass_reference ~ '^[a-f0-9]{64}$');
create index redemptions_consumer_created on public.redemptions(consumer_id,created_at desc) where consumer_id is not null;
alter table public.redemptions drop constraint redemptions_status_check;
alter table public.redemptions add constraint redemptions_status_check check(status in ('pending','created','redeemed','expired','cancelled','refunded'));
create index redemptions_pending_expiry on public.redemptions(merchant_offer_id,expires_at) where status='pending';

create table public.marketplace_outbox (
  id uuid primary key default gen_random_uuid(),consumer_id uuid references public.marketplace_consumers(id),
  merchant_id uuid references public.merchants(id),recipient text,channel text not null default 'email' check(channel='email'),
  event text not null,offer_id uuid references public.merchant_offers(id),watch_id uuid,
  status text not null default 'pending_provider' check(status in ('pending_provider','queued','sending','sent','failed','cancelled')),
  dedupe_key text not null unique,payload jsonb not null default '{}',created_at timestamptz not null default now(),
  scheduled_at timestamptz not null default now(),sent_at timestamptz,failed_at timestamptz
);
alter table public.marketplace_outbox enable row level security;
revoke all on public.marketplace_outbox from public,anon,authenticated;
grant select,insert,update on public.marketplace_outbox to service_role;
create index marketplace_outbox_due on public.marketplace_outbox(status,scheduled_at);

create table public.marketplace_rate_limits (
  bucket text not null,window_start timestamptz not null,hits integer not null,
  primary key(bucket,window_start)
);
alter table public.marketplace_rate_limits enable row level security;
revoke all on public.marketplace_rate_limits from public,anon,authenticated;
create or replace function public.marketplace_rate_limit(p_bucket text,p_max integer,p_seconds integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare n integer; w timestamptz;
begin
  if p_max<1 or p_seconds<1 or length(p_bucket)>200 then raise exception 'invalid_rate_limit'; end if;
  w:=to_timestamp(floor(extract(epoch from now())/p_seconds)*p_seconds);
  insert into public.marketplace_rate_limits values(p_bucket,w,1)
  on conflict(bucket,window_start) do update set hits=marketplace_rate_limits.hits+1 returning hits into n;
  return n<=p_max;
end $$;

create or replace function public.marketplace_identity(p_hash text)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'identity_required'; end if;
  insert into public.marketplace_consumers(credential_hash) values(p_hash) on conflict(credential_hash) do nothing;
  select id into cid from public.marketplace_consumers where credential_hash=p_hash;
  return cid;
end $$;

create or replace function public.marketplace_expire_pending(p_offer uuid)
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare restored integer;
begin
  perform 1 from public.merchant_offers where id=p_offer for update;
  with expired as (
    update public.redemptions set status='expired',updated_at=now() where merchant_offer_id=p_offer and status='pending' and expires_at<=now() returning party_size
  ) select coalesce(sum(party_size),0) into restored from expired;
  update public.merchant_offers set capacity_remaining=capacity_remaining+restored,updated_at=now() where id=p_offer and restored>0;
  return restored;
end $$;

create or replace function public.marketplace_claim(p_hash text,p_offer uuid,p_quantity integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid; o public.merchant_offers%rowtype; r public.redemptions%rowtype; result jsonb; pending boolean;
begin
  cid:=public.marketplace_identity(p_hash);
  if p_quantity is null or p_quantity<1 or p_quantity>20 then raise exception 'invalid_quantity'; end if;
  select * into o from public.merchant_offers where id=p_offer and status='active' for update;
  if not found or o.visibility<>'public' then raise exception 'offer_not_available'; end if;
  if o.action_type='booking_claim' or o.fulfilment_mode not in ('direct_claim','merchant_confirmation') then raise exception 'direct_claim_not_allowed'; end if;
  if o.ends_at is null or o.ends_at<=now() then raise exception 'offer_ended'; end if;
  perform public.marketplace_expire_pending(o.id);
  select * into r from public.redemptions where consumer_id=cid and merchant_offer_id=o.id and status in ('pending','created','redeemed') order by created_at desc limit 1;
  if found then return jsonb_build_object('reused',true,'redemption',to_jsonb(r)); end if;
  select * into o from public.merchant_offers where id=o.id;
  if o.capacity_remaining is null or o.capacity_remaining<p_quantity then raise exception 'insufficient_capacity'; end if;
  pending:=o.fulfilment_mode='merchant_confirmation';
  update public.merchant_offers set capacity_remaining=capacity_remaining-p_quantity,updated_at=now() where id=o.id;
  insert into public.redemptions(merchant_id,merchant_offer_id,catalogue_item_id,session_id,consumer_id,redemption_code,pass_reference,status,party_size,gross_value,discount_value,commission_value,currency,expires_at,metadata)
  values(o.merchant_id,o.id,o.published_drop_id,p_hash,cid,'PD-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,16)),replace(gen_random_uuid()::text||gen_random_uuid()::text,'-',''),
    case when pending then 'pending' else 'created' end,p_quantity,coalesce(o.normal_price,o.deal_price)*p_quantity,greatest(0,coalesce(o.normal_price,o.deal_price)-o.deal_price)*p_quantity,0,'AUD',
    case when pending then least(o.ends_at,now()+interval '15 minutes') else o.ends_at end,
    jsonb_build_object('offer_title',o.title,'inventory_unit',o.inventory_unit,'vertical',o.vertical,'value_basis','gross_before_discount','valid_from',o.starts_at,'valid_until',o.ends_at,'terms',o.conditions,'fulfilment_mode',o.fulfilment_mode)) returning * into r;
  return jsonb_build_object('reused',false,'redemption',to_jsonb(r),'capacity_remaining',o.capacity_remaining-p_quantity);
end $$;

create or replace function public.marketplace_confirm(p_actor uuid,p_merchant uuid,p_redemption uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.redemptions%rowtype; oid uuid;
begin
  if not public.marketplace_can_manage(p_actor,p_merchant,true) then raise exception 'merchant_access_denied'; end if;
  select merchant_offer_id into oid from public.redemptions where id=p_redemption and merchant_id=p_merchant;
  if not found then raise exception 'redemption_not_found'; end if;
  perform public.marketplace_expire_pending(oid);
  select * into r from public.redemptions where id=p_redemption and merchant_id=p_merchant for update;
  if r.status<>'pending' then return jsonb_build_object('changed',false,'redemption',to_jsonb(r)); end if;
  if p_accept is null then raise exception 'decision_required'; end if;
  update public.redemptions set status=case when p_accept then 'created' else 'cancelled' end,
    expires_at=case when p_accept then (metadata->>'valid_until')::timestamptz else expires_at end,
    metadata=metadata||jsonb_build_object('confirmed_by',p_actor,'decided_at',now()),updated_at=now() where id=r.id returning * into r;
  if not p_accept then update public.merchant_offers set capacity_remaining=capacity_remaining+r.party_size,updated_at=now() where id=oid; end if;
  return jsonb_build_object('changed',true,'redemption',to_jsonb(r));
end $$;

create table public.marketplace_saves (
  consumer_id uuid not null references public.marketplace_consumers(id),kind text not null check(kind in ('drop','merchant')),
  target text not null,created_at timestamptz not null default now(),primary key(consumer_id,kind,target)
);
alter table public.marketplace_saves enable row level security;
revoke all on public.marketplace_saves from public,anon,authenticated;
grant select,insert,delete on public.marketplace_saves to service_role;

create table public.marketplace_recovery (
  id uuid primary key default gen_random_uuid(),consumer_id uuid not null references public.marketplace_consumers(id),
  token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),scope text not null default 'identity_recovery' check(scope='identity_recovery'),
  expires_at timestamptz not null,used_at timestamptz,revoked_at timestamptz,created_at timestamptz not null default now()
);
alter table public.marketplace_recovery enable row level security;
revoke all on public.marketplace_recovery from public,anon,authenticated;
grant select,insert,update on public.marketplace_recovery to service_role;
create index marketplace_recovery_consumer on public.marketplace_recovery(consumer_id,created_at desc);

create or replace function public.marketplace_recover(p_token_hash text,p_new_hash text)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.marketplace_recovery%rowtype; cid uuid;
begin
  select consumer_id into cid from public.marketplace_recovery where token_hash=p_token_hash;
  if not found then return false; end if;
  perform 1 from public.marketplace_consumers where id=cid for update;
  select * into r from public.marketplace_recovery where token_hash=p_token_hash and scope='identity_recovery' for update;
  if not found or r.expires_at<=now() or r.used_at is not null or r.revoked_at is not null then return false; end if;
  if p_new_hash is null or p_new_hash !~ '^[a-f0-9]{64}$' then raise exception 'identity_required'; end if;
  update public.marketplace_consumers set credential_hash=p_new_hash where id=r.consumer_id;
  update public.marketplace_recovery set used_at=now() where id=r.id;
  update public.marketplace_recovery set revoked_at=now() where consumer_id=r.consumer_id and id<>r.id and used_at is null and revoked_at is null;
  return true;
end $$;

revoke all on function public.marketplace_rate_limit(text,integer,integer),public.marketplace_identity(text),public.marketplace_expire_pending(uuid),public.marketplace_claim(text,uuid,integer),public.marketplace_confirm(uuid,uuid,uuid,boolean),public.marketplace_recover(text,text) from public,anon,authenticated;
grant execute on function public.marketplace_rate_limit(text,integer,integer),public.marketplace_identity(text),public.marketplace_expire_pending(uuid),public.marketplace_claim(text,uuid,integer),public.marketplace_confirm(uuid,uuid,uuid,boolean),public.marketplace_recover(text,text) to service_role;
