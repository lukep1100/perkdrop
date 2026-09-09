-- Candidate: applied to the isolated production-core baseline by test:database.
-- Not an applied migration. Record the server-assigned migration version only after deployment.

-- The verified Edge user ID is supplied by the service only, never trusted from request JSON.
create or replace function public.merchant_offer_control(p_actor uuid, p_merchant uuid, p_offer uuid, p_action text, p_capacity integer default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.merchant_offers%rowtype; allocated integer;
begin
  if not public.marketplace_can_manage(p_actor,p_merchant,true) then
    raise exception 'merchant_access_denied';
  end if;
  select * into o from public.merchant_offers where id=p_offer and merchant_id=p_merchant for update;
  if not found then raise exception 'offer_not_found'; end if;
  case p_action
    when 'offer_resume' then
      if o.status<>'paused' or o.published_drop_id is null or coalesce((o.metadata->>'requires_review')::boolean,false) then raise exception 'offer_not_resumable'; end if;
      if o.ends_at<=now() then raise exception 'offer_ended'; end if;
      update public.merchant_offers set status='active',updated_at=now() where id=o.id returning * into o;
      update public.catalogue_items set active=true where id=o.published_drop_id;
    when 'offer_pause' then
      if o.status<>'active' then raise exception 'offer_not_active'; end if;
      update public.merchant_offers set status='paused',updated_at=now() where id=o.id returning * into o;
      update public.catalogue_items set active=false where id=o.published_drop_id;
    when 'offer_close' then
      if o.status not in ('active','paused','pending') then raise exception 'offer_not_open'; end if;
      update public.merchant_offers set status='expired',updated_at=now() where id=o.id returning * into o;
      update public.catalogue_items set active=false where id=o.published_drop_id;
    when 'offer_capacity' then
      if p_capacity is null or p_capacity<1 or p_capacity>10000 then raise exception 'invalid_capacity'; end if;
      if o.action_type='booking_claim' or exists(select 1 from public.offer_sessions where merchant_offer_id=o.id) then raise exception 'session_capacity_required'; end if;
      if o.capacity_total is null or o.capacity_remaining is null then raise exception 'capacity_not_configured'; end if;
      allocated:=o.capacity_total-o.capacity_remaining;
      if p_capacity<allocated then raise exception 'capacity_below_already_claimed'; end if;
      update public.merchant_offers set capacity_total=p_capacity,capacity_remaining=p_capacity-allocated,updated_at=now() where id=o.id returning * into o;
    else raise exception 'invalid_offer_action';
  end case;
  return to_jsonb(o);
end $$;
revoke all on function public.merchant_offer_control(uuid,uuid,uuid,text,integer) from public,anon,authenticated;
grant execute on function public.merchant_offer_control(uuid,uuid,uuid,text,integer) to service_role;

-- Protect all writers, including existing owner publication and edit endpoints.
create or replace function public.guard_offer_capacity_edit()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare allocated integer;
begin
  if new.capacity_total is distinct from old.capacity_total then
    if old.action_type='booking_claim' or exists(select 1 from public.offer_sessions where merchant_offer_id=old.id) then raise exception 'session_capacity_required'; end if;
    allocated:=greatest(0,coalesce(old.capacity_total,0)-coalesce(old.capacity_remaining,0));
    if new.capacity_total is null or new.capacity_total<allocated then raise exception 'capacity_below_already_claimed'; end if;
    new.capacity_remaining:=new.capacity_total-allocated;
  end if;
  return new;
end $$;
create trigger marketplace_capacity_edit before update of capacity_total on public.merchant_offers
for each row execute function public.guard_offer_capacity_edit();

CREATE OR REPLACE FUNCTION public.claim_merchant_offer(p_offer_id uuid, p_drop_id text, p_session_id text, p_party_size integer, p_redemption_code text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_offer public.merchant_offers%rowtype;
  v_existing public.redemptions%rowtype;
  v_redemption public.redemptions%rowtype;
  v_offer_session public.offer_sessions%rowtype;
  v_gross numeric;
  v_discount numeric;
  v_service_start timestamptz;
  v_service_end timestamptz;
begin
  if p_party_size is null or p_party_size < 1 or p_party_size > 20 then
    raise exception 'invalid_party_size';
  end if;

  select * into v_offer
  from public.merchant_offers
  where id = p_offer_id and status = 'active'
  for update;

  if not found then
    raise exception 'redemption_not_available';
  end if;


  if v_offer.action_type = 'booking_claim' or v_offer.fulfilment_mode <> 'direct_claim' or v_offer.action_type not in ('redemption_code','in_store_claim','free_claim') then
    raise exception 'direct_claim_not_allowed';
  end if;
  if nullif(trim(p_session_id),'') is null then raise exception 'identity_required'; end if;

  if v_offer.starts_at is not null and v_offer.starts_at > now() then
    raise exception 'offer_not_started';
  end if;
  if v_offer.ends_at is not null and v_offer.ends_at < now() then
    raise exception 'offer_ended';
  end if;

  select * into v_existing
  from public.redemptions
  where merchant_offer_id = v_offer.id
    and session_id = p_session_id
    and status in ('created','redeemed')
  order by created_at desc
  limit 1;

  if found then
    return jsonb_build_object(
      'reused', true,
      'capacity_remaining', case
        when (v_existing.metadata->>'offer_session_id') is not null then (
          select s.capacity_remaining
          from public.offer_sessions s
          where s.id = (v_existing.metadata->>'offer_session_id')::uuid
        )
        else v_offer.capacity_remaining
      end,
      'redemption', to_jsonb(v_existing)
    );
  end if;

  if v_offer.action_type = 'booking_claim' then
    select * into v_offer_session
    from public.offer_sessions s
    where s.merchant_offer_id = v_offer.id
      and s.status = 'active'
      and s.capacity_remaining >= p_party_size
      and ((s.service_date + s.service_end) at time zone s.timezone) > now()
    order by s.service_date, s.service_start
    for update skip locked
    limit 1;

    if not found then
      raise exception 'no_eligible_service';
    end if;

    v_service_start := (v_offer_session.service_date + v_offer_session.service_start) at time zone v_offer_session.timezone;
    v_service_end := (v_offer_session.service_date + v_offer_session.service_end) at time zone v_offer_session.timezone;

    update public.offer_sessions
    set capacity_remaining = capacity_remaining - p_party_size,
        updated_at = now()
    where id = v_offer_session.id
    returning * into v_offer_session;
  elsif v_offer.capacity_remaining is not null then
    if p_party_size > v_offer.capacity_remaining then
      raise exception 'insufficient_capacity';
    end if;

    update public.merchant_offers
    set capacity_remaining = capacity_remaining - p_party_size,
        updated_at = now()
    where id = v_offer.id
    returning * into v_offer;
  end if;

  v_gross := case when v_offer.deal_price is null then null else v_offer.deal_price * p_party_size end;
  v_discount := case when v_offer.normal_price is null or v_offer.deal_price is null then null else greatest(0, v_offer.normal_price - v_offer.deal_price) * p_party_size end;

  insert into public.redemptions (
    merchant_id,
    merchant_offer_id,
    catalogue_item_id,
    redemption_code,
    session_id,
    status,
    party_size,
    gross_value,
    discount_value,
    commission_value,
    currency,
    expires_at,
    metadata
  ) values (
    v_offer.merchant_id,
    v_offer.id,
    coalesce(v_offer.published_drop_id,p_drop_id),
    p_redemption_code,
    p_session_id,
    'created',
    p_party_size,
    v_gross,
    v_discount,
    0,
    'AUD',
    case when v_offer.action_type = 'booking_claim' then v_service_end else coalesce(v_offer.ends_at,now()+interval '24 hours') end,
    case
      when v_offer.action_type = 'booking_claim' then jsonb_build_object(
        'offer_title', v_offer.title,
        'offer_session_id', v_offer_session.id,
        'service_date', v_offer_session.service_date,
        'service_start', v_offer_session.service_start,
        'service_end', v_offer_session.service_end,
        'timezone', v_offer_session.timezone,
        'valid_from', v_service_start,
        'valid_until', v_service_end,
        'booking_window_enforced', true
      )
      else jsonb_build_object('offer_title',v_offer.title)
    end
  ) returning * into v_redemption;

  return jsonb_build_object(
    'reused', false,
    'capacity_remaining', case when v_offer.action_type = 'booking_claim' then v_offer_session.capacity_remaining else v_offer.capacity_remaining end,
    'redemption', to_jsonb(v_redemption)
  );
end;
$function$
;



-- Candidate release SQL; tested on isolated Postgres before deployment.
alter table public.merchant_commercial_terms drop constraint merchant_commercial_terms_model_check;
alter table public.merchant_commercial_terms add constraint merchant_commercial_terms_model_check
check(model in ('none','cpa','revenue_share','cpc','subscription','affiliate','hybrid','per_unit','per_booking','percentage_of_tracked_value'));

-- AUD amounts rounded once per redemption. Percentage base is actual post-discount
-- tracked value. Legacy cpa means per unit; revenue_share means percentage.
-- Subscription/monthly hybrid fees are not multiplied by redemptions.
create or replace function public.marketplace_fee(p_model text,p_units integer,p_tracked_net numeric,p_flat numeric,p_rate numeric)
returns numeric language plpgsql immutable set search_path=public,pg_temp as $$
begin
  if p_units is null or p_units<1 or coalesce(p_tracked_net,0)<0 or coalesce(p_flat,0)<0 or coalesce(p_rate,0)<0 or coalesce(p_rate,0)>1 then raise exception 'invalid_fee_inputs'; end if;
  return round(case
    when p_model in ('per_unit','cpa') then coalesce(p_flat,0)*p_units
    when p_model='per_booking' then coalesce(p_flat,0)
    when p_model in ('percentage_of_tracked_value','revenue_share') then coalesce(p_tracked_net,0)*coalesce(p_rate,0)
    when p_model='hybrid' then coalesce(p_flat,0)*p_units+coalesce(p_tracked_net,0)*coalesce(p_rate,0)
    when p_model in ('none','subscription','cpc','affiliate') then 0
    else null end,2);
end $$;
revoke all on function public.marketplace_fee(text,integer,numeric,numeric,numeric) from public,anon,authenticated;
grant execute on function public.marketplace_fee(text,integer,numeric,numeric,numeric) to service_role;

create or replace function public.redeem_merchant_redemption_with_spend(p_merchant_id uuid,p_redemption_code text,p_merchant_reference text default null,p_eligible_food_subtotal numeric default null)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare r public.redemptions%rowtype; o public.merchant_offers%rowtype; t public.merchant_commercial_terms%rowtype;
  gross numeric; discount numeric; net numeric; fee numeric:=0; basis text;
begin
  if p_eligible_food_subtotal is not null and (p_eligible_food_subtotal<0 or p_eligible_food_subtotal>100000) then raise exception 'invalid_eligible_food_subtotal'; end if;
  select * into r from public.redemptions where merchant_id=p_merchant_id and redemption_code=upper(trim(p_redemption_code)) for update;
  if not found then raise exception 'redemption_not_found'; end if;
  if r.status<>'created' then raise exception 'redemption_not_available'; end if;
  if r.expires_at<=now() then raise exception 'redemption_expired'; end if;
  if (r.metadata->>'valid_from')::timestamptz>now() then raise exception 'service_not_started'; end if;
  select * into o from public.merchant_offers where id=r.merchant_offer_id and merchant_id=p_merchant_id;
  gross:=coalesce(p_eligible_food_subtotal,r.gross_value);
  discount:=coalesce(r.discount_value,0);
  basis:=coalesce(r.metadata->>'value_basis','legacy_post_discount');
  if p_eligible_food_subtotal is not null then
    basis:='gross_before_discount';
    if o.discount_type='percent' and o.discount_percent is not null then discount:=round(gross*o.discount_percent/100,2); end if;
  end if;
  if o.discount_type='percent' and gross is null then raise exception 'eligible_spend_required'; end if;
  net:=case when basis='gross_before_discount' then greatest(0,gross-discount) else gross end;
  select * into t from public.merchant_commercial_terms where merchant_id=p_merchant_id and status='active' and effective_from<=now() and (effective_to is null or effective_to>now()) order by effective_from desc,created_at desc limit 1;
  if found then
    if t.model in ('percentage_of_tracked_value','revenue_share','hybrid') and coalesce(t.commission_rate,0)>0 and net is null then raise exception 'tracked_value_required'; end if;
    fee:=public.marketplace_fee(t.model,r.party_size,net,t.commission_flat,t.commission_rate);
    if fee is null then raise exception 'unsupported_commercial_model'; end if;
  end if;
  update public.redemptions set status='redeemed',redeemed_at=now(),merchant_reference=coalesce(nullif(trim(p_merchant_reference),''),merchant_reference),
    gross_value=gross,discount_value=discount,commission_value=fee,updated_at=now(),
    metadata=metadata||jsonb_build_object('value_basis',basis,'tracked_net',net,'commercial_term_id',t.id,'fee_model',coalesce(t.model,'none'),'spend_captured',p_eligible_food_subtotal is not null)
    where id=r.id returning * into r;
  if fee>0 then
    insert into public.commission_ledger(merchant_id,redemption_id,entry_type,gross_value,perkdrop_value,merchant_value,currency,status,occurred_at,metadata)
    values(r.merchant_id,r.id,'commission',gross,fee,net-fee,r.currency,'approved',now(),jsonb_build_object('commercial_term_id',t.id,'fee_model',t.model,'party_size',r.party_size,'tracked_net',net,'discount_value',discount,'merchant_offer_id',r.merchant_offer_id))
    on conflict(redemption_id) where redemption_id is not null do nothing;
  end if;
  return to_jsonb(r);
end $$;

-- All merchant entry points share the same service-window checks and fee function.
create or replace function public.redeem_merchant_redemption(p_merchant_id uuid,p_redemption_code text,p_merchant_reference text default null)
returns jsonb language sql security definer set search_path=public,pg_temp as $$
  select public.redeem_merchant_redemption_with_spend(p_merchant_id,p_redemption_code,p_merchant_reference,null);
$$;
revoke all on function public.redeem_merchant_redemption(uuid,text,text),public.redeem_merchant_redemption_with_spend(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.redeem_merchant_redemption(uuid,text,text),public.redeem_merchant_redemption_with_spend(uuid,text,text,numeric) to service_role;



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



alter table public.demand_signals add column consumer_id uuid references public.marketplace_consumers(id);
alter table public.demand_signals add column precinct text;
alter table public.demand_signals add column time_window text;
alter table public.demand_signals add column radius_km numeric check(radius_km between 1 and 100);
alter table public.demand_signals add column budget numeric check(budget>=0);
create unique index demand_one_active_intent on public.demand_signals(consumer_id,city,vertical,time_window) where status='open' and consumer_id is not null;
create index demand_consumer on public.demand_signals(consumer_id) where consumer_id is not null;

create or replace function public.marketplace_standby(p_consumer uuid,p_city text,p_vertical text,p_window text,p_precinct text,p_quantity integer,p_radius numeric,p_budget numeric,p_expires timestamptz)
returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
  if p_quantity is null or p_quantity<1 or p_quantity>20 or p_expires<=now() or p_expires>now()+interval '7 days' then raise exception 'invalid_demand'; end if;
  perform 1 from public.marketplace_consumers where id=p_consumer for update;
  if not found then raise exception 'identity_required'; end if;
  update public.demand_signals set status='expired' where consumer_id=p_consumer and status='open' and expires_at<=now();
  insert into public.demand_signals(consumer_id,city,vertical,time_window,precinct,quantity,radius_km,budget,expires_at)
  values(p_consumer,p_city,p_vertical,p_window,p_precinct,p_quantity,p_radius,p_budget,p_expires)
  on conflict(consumer_id,city,vertical,time_window) where status='open' and consumer_id is not null
  do update set quantity=excluded.quantity,precinct=excluded.precinct,radius_km=excluded.radius_km,budget=excluded.budget,expires_at=excluded.expires_at returning id into result;
  return result;
end $$;
revoke all on function public.marketplace_standby(uuid,text,text,text,text,integer,numeric,numeric,timestamptz) from public,anon,authenticated;
grant execute on function public.marketplace_standby(uuid,text,text,text,text,integer,numeric,numeric,timestamptz) to service_role;

-- Merchant result deliberately contains no person-level columns. Count distinct
-- identities, never raw requests or quantity, for the privacy threshold.
create or replace function public.marketplace_demand(p_actor uuid,p_merchant uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare market text; result jsonb;
begin
  if not public.marketplace_can_manage(p_actor,p_merchant,false) then raise exception 'merchant_access_denied'; end if;
  select primary_city into market from public.merchants where id=p_merchant;
  select coalesce(jsonb_agg(to_jsonb(groups)),'[]') into result from (
    select city,precinct,vertical,time_window,count(distinct consumer_id) as distinct_users,sum(quantity) as quantity_requested
    from public.demand_signals where city=market and consumer_id is not null and status='open' and expires_at>now()
    group by city,precinct,vertical,time_window having count(distinct consumer_id)>=10
  ) groups;
  return result;
end $$;

create table public.marketplace_watches (
  id uuid primary key default gen_random_uuid(),consumer_id uuid not null references public.marketplace_consumers(id),
  name text not null check(length(name) between 1 and 120),active boolean not null default true,
  rule jsonb not null default '{}',created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.marketplace_watches enable row level security;
revoke all on public.marketplace_watches from public,anon,authenticated;
grant select,insert,update,delete on public.marketplace_watches to service_role;
create index marketplace_watches_consumer on public.marketplace_watches(consumer_id,active);
alter table public.marketplace_outbox add constraint marketplace_outbox_watch_fk foreign key(watch_id) references public.marketplace_watches(id) on delete set null;
revoke all on function public.marketplace_demand(uuid,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_demand(uuid,uuid) to service_role;

-- SQL is the authoritative matcher used by the scheduler and integration tests.
create or replace function public.marketplace_watch_matches(p_rule jsonb,p_offer public.merchant_offers,p_now timestamptz default now())
returns boolean language plpgsql stable set search_path=public,pg_temp as $$
declare local_clock timestamp; local_service timestamp; h integer; service_hour integer; qs integer; qe integer; distance numeric; time_match boolean;
begin
  if p_offer.status<>'active' or p_offer.visibility<>'public' or coalesce(p_offer.capacity_remaining,0)<=0 or p_offer.ends_at is null or p_offer.ends_at<=p_now then return false; end if;
  if nullif(p_rule->>'city','') is not null and p_rule->>'city'<>p_offer.city then return false; end if;
  if nullif(p_rule->>'merchant_id','') is not null and p_rule->>'merchant_id'<>p_offer.merchant_id::text then return false; end if;
  if nullif(p_rule->>'precinct','') is not null and p_rule->>'precinct' is distinct from p_offer.metadata->>'precinct' then return false; end if;
  if jsonb_array_length(coalesce(p_rule->'verticals','[]'))>0 and not (p_rule->'verticals' ? p_offer.vertical) then return false; end if;
  if jsonb_array_length(coalesce(p_rule->'drop_types','[]'))>0 and not (p_rule->'drop_types' ? p_offer.drop_type) then return false; end if;
  if p_rule->>'radius_km' is not null then
    if p_offer.latitude is null or p_offer.longitude is null or p_rule->>'latitude' is null or p_rule->>'longitude' is null then return false; end if;
    distance:=6371*acos(least(1.0,greatest(-1.0,sin(radians((p_rule->>'latitude')::double precision))*sin(radians(p_offer.latitude::double precision))+cos(radians((p_rule->>'latitude')::double precision))*cos(radians(p_offer.latitude::double precision))*cos(radians(p_offer.longitude::double precision-(p_rule->>'longitude')::double precision)))));
    if distance>(p_rule->>'radius_km')::numeric then return false; end if;
  end if;
  local_clock:=p_now at time zone coalesce(p_rule->>'timezone','Australia/Adelaide');
  local_service:=coalesce(p_offer.starts_at,p_now) at time zone coalesce(p_rule->>'timezone','Australia/Adelaide');
  h:=extract(hour from local_clock);service_hour:=extract(hour from local_service);
  qs:=coalesce((p_rule->>'quiet_start')::integer,22);qe:=coalesce((p_rule->>'quiet_end')::integer,7);
  if (qs<qe and h>=qs and h<qe) or (qs>qe and (h>=qs or h<qe)) then return false; end if;
  if jsonb_array_length(coalesce(p_rule->'times','[]'))>0 then
    time_match:=((p_rule->'times' ? 'morning') and service_hour>=5 and service_hour<11)
      or ((p_rule->'times' ? 'lunch') and service_hour>=11 and service_hour<15)
      or ((p_rule->'times' ? 'afternoon') and service_hour>=15 and service_hour<18)
      or ((p_rule->'times' ? 'evening') and service_hour>=18)
      or ((p_rule->'times' ? 'weekend') and extract(isodow from local_service) in (6,7));
    if not time_match then return false; end if;
  end if;
  return true;
end $$;

create or replace function public.marketplace_match_notifications(p_now timestamptz default now())
returns integer language plpgsql security definer set search_path=public,pg_temp as $$
declare w public.marketplace_watches%rowtype; o public.merchant_offers%rowtype; c public.marketplace_consumers%rowtype; recent integer; added integer; total integer:=0;
begin
  -- Avoid overlapping scheduled/manual matchers; all work stays in this transaction.
  if not pg_try_advisory_xact_lock(184231,1) then return 0; end if;
  for w in select * from public.marketplace_watches where active order by consumer_id,id loop
    select * into c from public.marketplace_consumers where id=w.consumer_id;
    for o in select * from public.merchant_offers where status='active' and visibility='public' and ends_at>p_now and capacity_remaining>0 and (nullif(w.rule->>'city','') is null or city=w.rule->>'city') order by created_at desc loop
      select count(*) into recent from public.marketplace_outbox where consumer_id=c.id and event='watch_match' and created_at>p_now-interval '24 hours' and status<>'cancelled';
      if recent>=least(10,greatest(1,coalesce((w.rule->>'daily_cap')::integer,3))) then exit; end if;
      if public.marketplace_watch_matches(w.rule,o,p_now) then
        insert into public.marketplace_outbox(consumer_id,recipient,event,offer_id,watch_id,dedupe_key,payload,created_at,scheduled_at)
        values(c.id,case when c.email_verified_at is not null then c.email end,'watch_match',o.id,w.id,'watch:'||c.id||':'||o.id,jsonb_build_object('offer_title',o.title,'drop_id',o.published_drop_id),p_now,p_now)
        on conflict(dedupe_key) do nothing;
        get diagnostics added=row_count;total:=total+added;
      end if;
    end loop;
  end loop;
  return total;
end $$;
create index marketplace_outbox_consumer_frequency on public.marketplace_outbox(consumer_id,event,created_at desc);
revoke all on function public.marketplace_watch_matches(jsonb,public.merchant_offers,timestamptz),public.marketplace_match_notifications(timestamptz) from public,anon,authenticated;
grant execute on function public.marketplace_watch_matches(jsonb,public.merchant_offers,timestamptz),public.marketplace_match_notifications(timestamptz) to service_role;



create table public.business_groups(id uuid primary key default gen_random_uuid(),name text not null,created_at timestamptz not null default now());
create table public.business_group_members(group_id uuid not null references public.business_groups(id),user_id uuid not null,role text not null check(role in ('admin','analyst')),active boolean not null default true,primary key(group_id,user_id));
alter table public.merchants add column business_group_id uuid references public.business_groups(id);
create index merchants_business_group on public.merchants(business_group_id) where business_group_id is not null;
create index business_group_members_user on public.business_group_members(user_id,active);
alter table public.business_groups enable row level security;
alter table public.business_group_members enable row level security;
revoke all on public.business_groups,public.business_group_members from public,anon,authenticated;
grant select,insert,update,delete on public.business_groups,public.business_group_members to service_role;

create or replace function public.marketplace_can_manage(p_actor uuid,p_merchant uuid,p_write boolean default true)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(select 1 from public.merchant_members where user_id=p_actor and merchant_id=p_merchant and status='active' and (not p_write or role in ('owner','admin','editor')))
  or exists(select 1 from public.business_group_members gm join public.merchants m on m.business_group_id=gm.group_id where gm.user_id=p_actor and m.id=p_merchant and gm.active and (not p_write or gm.role='admin'));
$$;

create table public.merchant_pilots(
 merchant_id uuid primary key references public.merchants(id),stage text not null default 'lead' check(stage in ('lead','pilot','proven','commercial','retained')),
 pilot_start date,pilot_end date,review_date date,commercial_review_date date,result text,next_action text,commercial_offer text,updated_at timestamptz not null default now()
);
create table public.merchant_autopilot(
 merchant_id uuid primary key references public.merchants(id),rule jsonb not null default '{}',updated_at timestamptz not null default now(),updated_by uuid
);
create table public.merchant_report_snapshots(
 id uuid primary key default gen_random_uuid(),merchant_id uuid not null references public.merchants(id),offer_id uuid not null unique references public.merchant_offers(id),
 snapshot jsonb not null,created_at timestamptz not null default now()
);
create index merchant_report_snapshots_merchant on public.merchant_report_snapshots(merchant_id,created_at desc);
alter table public.merchant_pilots enable row level security;
alter table public.merchant_autopilot enable row level security;
alter table public.merchant_report_snapshots enable row level security;
revoke all on public.merchant_pilots,public.merchant_autopilot,public.merchant_report_snapshots from public,anon,authenticated;
grant select,insert,update on public.merchant_pilots,public.merchant_autopilot to service_role;
grant select on public.merchant_report_snapshots to service_role;

create or replace function public.marketplace_offer_roi(p_offer uuid)
returns jsonb language sql stable security definer set search_path=public,pg_temp as $$
  with o as (select * from public.merchant_offers where id=p_offer),
  alloc as(select coalesce(sum(s.capacity_total),(select capacity_total from o),0) total,coalesce(sum(s.capacity_remaining),(select capacity_remaining from o),0) remaining from public.offer_sessions s where merchant_offer_id=p_offer),
  r as(select *,case when metadata->>'value_basis'='gross_before_discount' then gross_value else gross_value+coalesce(discount_value,0) end tracked_gross,
    case when metadata->>'value_basis'='gross_before_discount' then greatest(0,gross_value-coalesce(discount_value,0)) else gross_value end tracked_net
    from public.redemptions where merchant_offer_id=p_offer)
  select jsonb_build_object('offer_id',o.id,'merchant_id',o.merchant_id,'title',o.title,'vertical',o.vertical,'unit',o.inventory_unit,'starts_at',o.starts_at,'ends_at',o.ends_at,
    'capacity_total',a.total,'remaining',a.remaining,
    'held',coalesce((select sum(party_size) from r where status='pending' and expires_at>now()),0)+coalesce((select sum(party_size) from public.booking_claim_holds where merchant_offer_id=o.id and status='held' and expires_at>now()),0),
    'confirmed',coalesce((select sum(party_size) from r where status in ('created','redeemed')),0),
    'customers_delivered',coalesce((select sum(party_size) from r where status='redeemed'),0),
    'bookings',(select count(*) from r where status in ('created','redeemed')),
    'redemptions',(select count(*) from r where status='redeemed'),
    'fill_rate',case when a.total>0 then round(coalesce((select sum(party_size) from r where status in ('created','redeemed')),0)::numeric/a.total,4) else null end,
    'tracked_gross',(select sum(tracked_gross) from r where status='redeemed' and gross_value is not null),
    'discount_value',(select sum(discount_value) from r where status='redeemed' and gross_value is not null),
    'tracked_net',(select sum(tracked_net) from r where status='redeemed' and gross_value is not null),
    'average_tracked_spend',(select round(avg(tracked_net),2) from r where status='redeemed' and gross_value is not null),
    'untracked_redemptions',(select count(*) from r where status='redeemed' and gross_value is null),
    'fee',coalesce((select sum(commission_value) from r where status='redeemed'),0)) from o cross join alloc a;
$$;

create or replace function public.marketplace_close_report(p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.merchant_offers%rowtype; report jsonb; rid uuid;
begin
  select * into o from public.merchant_offers where id=p_offer for update;
  if not found or o.ends_at is null or o.ends_at>now() then raise exception 'service_not_closed'; end if;
  select snapshot into report from public.merchant_report_snapshots where offer_id=o.id;
  if found then return report; end if;
  perform public.marketplace_expire_pending(o.id);
  report:=public.marketplace_offer_roi(o.id);
  insert into public.merchant_report_snapshots(merchant_id,offer_id,snapshot) values(o.merchant_id,o.id,report) returning id into rid;
  -- Recipient resolution uses verified Auth users, not arbitrary merchant profile emails.
  -- The guarded dynamic query keeps isolated core tests independent of the Auth schema.
  if to_regclass('auth.users') is not null then
    execute $q$insert into public.marketplace_outbox(merchant_id,recipient,event,offer_id,dedupe_key,payload)
      select $1,u.email,'service_report',$2,'report:'||$3||':'||u.id,$4 from public.merchant_members mm join auth.users u on u.id=mm.user_id
      where mm.merchant_id=$1 and mm.status='active' and mm.role in ('owner','admin') and u.email_confirmed_at is not null and u.email is not null
      on conflict(dedupe_key) do nothing$q$ using o.merchant_id,o.id,rid,report;
  end if;
  return report;
end $$;

-- Atomic activation: invalid new terms cannot accidentally end the current agreement.
create or replace function public.marketplace_activate_terms(p_merchant uuid,p_model text,p_flat numeric,p_rate numeric,p_monthly numeric,p_actor text)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare t public.merchant_commercial_terms%rowtype;
begin
  if p_model not in ('none','per_unit','per_booking','percentage_of_tracked_value','subscription','hybrid','cpa','revenue_share','cpc','affiliate') or coalesce(p_flat,0)<0 or coalesce(p_rate,0)<0 or coalesce(p_rate,0)>1 or coalesce(p_monthly,0)<0 then raise exception 'invalid_terms'; end if;
  perform 1 from public.merchants where id=p_merchant for update;
  if not found then raise exception 'merchant_not_found'; end if;
  update public.merchant_commercial_terms set status='ended',effective_to=now() where merchant_id=p_merchant and status='active';
  insert into public.merchant_commercial_terms(merchant_id,model,commission_flat,commission_rate,monthly_fee,status,effective_from,metadata)
  values(p_merchant,p_model,p_flat,p_rate,p_monthly,'active',now(),jsonb_build_object('activated_by',p_actor,'percentage_basis','tracked_post_discount','subscription_accrual','full_month_from_next_month_boundary')) returning * into t;
  return to_jsonb(t);
end $$;

create unique index marketplace_subscription_period on public.commission_ledger((metadata->>'commercial_term_id'),(metadata->>'billing_period')) where entry_type='subscription' and metadata->>'commercial_term_id' is not null and metadata->>'billing_period' is not null;
create or replace function public.marketplace_maintenance()
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare oid uuid; restored integer:=0; reports integer:=0; matched integer; period timestamptz:=date_trunc('month',now() at time zone 'UTC') at time zone 'UTC';
begin
  if not pg_try_advisory_xact_lock(184231,2) then return jsonb_build_object('busy',true); end if;
  for oid in select distinct merchant_offer_id from public.redemptions where status='pending' and expires_at<=now() limit 250 loop restored:=restored+public.marketplace_expire_pending(oid); end loop;
  update public.demand_signals set status='expired' where status='open' and expires_at<=now();
  for oid in select o.id from public.merchant_offers o where o.ends_at<=now() and not exists(select 1 from public.merchant_report_snapshots s where s.offer_id=o.id) and o.status in ('active','paused','expired') limit 250 loop perform public.marketplace_close_report(oid);reports:=reports+1;end loop;
  matched:=public.marketplace_match_notifications();
  insert into public.commission_ledger(merchant_id,entry_type,perkdrop_value,currency,status,occurred_at,metadata)
  select merchant_id,'subscription',monthly_fee,currency,'approved',period,jsonb_build_object('commercial_term_id',id,'billing_period',to_char(period,'YYYY-MM'),'billing_basis','full_month')
  from public.merchant_commercial_terms where status='active' and model in ('subscription','hybrid') and monthly_fee>0 and effective_from<=period and (effective_to is null or effective_to>period)
  on conflict do nothing;
  delete from public.marketplace_rate_limits where window_start<now()-interval '2 days';
  return jsonb_build_object('restored_units',restored,'reports',reports,'matched_notifications',matched);
end $$;
revoke all on function public.marketplace_can_manage(uuid,uuid,boolean),public.marketplace_offer_roi(uuid),public.marketplace_close_report(uuid),public.marketplace_activate_terms(uuid,text,numeric,numeric,numeric,text),public.marketplace_maintenance() from public,anon,authenticated;
grant execute on function public.marketplace_can_manage(uuid,uuid,boolean),public.marketplace_offer_roi(uuid),public.marketplace_close_report(uuid),public.marketplace_activate_terms(uuid,text,numeric,numeric,numeric,text),public.marketplace_maintenance() to service_role;

create or replace function public.marketplace_publish(p_actor uuid,p_merchant uuid,p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.merchant_offers%rowtype; m public.merchants%rowtype; dropid text; slug text; image text;
begin
  if not public.marketplace_can_manage(p_actor,p_merchant,true) then raise exception 'merchant_access_denied'; end if;
  select * into m from public.merchants where id=p_merchant;
  if m.listing_status not in ('verified','partner') then raise exception 'verified_merchant_required'; end if;
  select * into o from public.merchant_offers where id=p_offer and merchant_id=p_merchant for update;
  if not found or o.status not in ('draft','pending','paused','rejected') then raise exception 'offer_not_publishable'; end if;
  if o.action_type='booking_claim' or exists(select 1 from public.offer_sessions where merchant_offer_id=o.id) then raise exception 'provider_publication_requires_review'; end if;
  if o.fulfilment_mode not in ('direct_claim','merchant_confirmation','external_booking') or o.visibility<>'public' then raise exception 'unsupported_publication_mode'; end if;
  if o.fulfilment_mode='external_booking' and (o.booking_url is null or o.booking_url !~ '^https://') then raise exception 'booking_url_required'; end if;
  if o.capacity_total is null or o.capacity_total<1 or o.capacity_remaining is null or o.starts_at is null or o.ends_at is null or o.ends_at<=now() or o.ends_at<=o.starts_at then raise exception 'capacity_and_schedule_required'; end if;
  if length(coalesce(o.conditions,''))<12 or nullif(o.location,'') is null or nullif(o.city,'') is null then raise exception 'terms_and_location_required'; end if;
  if o.normal_price is not null and o.deal_price is not null and o.normal_price<o.deal_price then raise exception 'invalid_value'; end if;
  image:=case when o.metadata->>'media_rights_confirmed'='true' then o.media_url when m.media_rights_confirmed then m.hero_image_url end;
  if image is null or image !~ '^https://' then raise exception 'authorised_image_required'; end if;
  dropid:=coalesce(o.published_drop_id,'PD-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
  select c.slug into slug from public.catalogue_items c where c.id=dropid;
  slug:=coalesce(slug,trim(both '-' from regexp_replace(lower(m.name||'-'||o.title),'[^a-z0-9]+','-','g'))||'-'||lower(right(dropid,8)));
  insert into public.catalogue_items(id,merchant,title,description,category,kind,city,state,location,timing,price,conditions,source,slug,detail_url,active,merchant_id,image_url,image_alt,metadata,offer_origin,exclusive)
  values(dropid,m.name,o.title,o.description,coalesce(o.category,o.vertical),case when o.vertical='events' then 'event' else 'deal' end,o.city,o.state,o.location,'See service time',case when o.deal_price is not null then '$'||o.deal_price else 'See terms' end,o.conditions,coalesce(o.booking_url,'https://perkdrop.au'),slug,'/deals/'||slug,true,m.id,image,o.title,jsonb_build_object('vertical',o.vertical,'drop_type',o.drop_type,'inventory_unit',o.inventory_unit,'fulfilment_mode',o.fulfilment_mode),'merchant_submitted',o.exclusive)
  on conflict(id) do update set title=excluded.title,description=excluded.description,category=excluded.category,kind=excluded.kind,city=excluded.city,state=excluded.state,location=excluded.location,price=excluded.price,conditions=excluded.conditions,source=excluded.source,active=true,image_url=excluded.image_url,metadata=excluded.metadata,updated_at=now();
  update public.merchant_offers set status='active',published_drop_id=dropid,metadata=metadata||jsonb_build_object('requires_review',false,'published_by',p_actor,'published_at',now()),updated_at=now() where id=o.id returning * into o;
  return to_jsonb(o);
end $$;
revoke all on function public.marketplace_publish(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_publish(uuid,uuid,uuid) to service_role;




