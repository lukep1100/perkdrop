-- Live production reconciliation for migration 20260909074906.
-- Function bodies below are exported from project khzpdyyywiucfhubxkev; do not hand-edit.

create index if not exists booking_claim_holds_expiry_idx on public.booking_claim_holds using btree (offer_session_id, expires_at) where status = 'held';
create index if not exists booking_claim_holds_merchant_offer_id_idx on public.booking_claim_holds using btree (merchant_offer_id);
create index if not exists booking_claim_holds_redemption_id_idx on public.booking_claim_holds using btree (redemption_id) where redemption_id is not null;
create index if not exists booking_claim_holds_session_idx on public.booking_claim_holds using btree (offer_session_id, session_id, status);
create index if not exists redemptions_merchant_status_idx on public.redemptions using btree (merchant_id, status, created_at desc);
create index if not exists redemptions_offer_idx on public.redemptions using btree (merchant_offer_id);
create index if not exists commission_ledger_redemption_idx on public.commission_ledger using btree (redemption_id);
create unique index if not exists commission_ledger_one_entry_per_redemption on public.commission_ledger using btree (redemption_id) where redemption_id is not null;

-- The earlier reconstruction declared reconcile_booking_session(uuid) RETURNS integer;
-- live production returns jsonb, so replace the incompatible signature explicitly.
drop function if exists public.reconcile_booking_session(uuid);

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

CREATE OR REPLACE FUNCTION public.confirm_booking_hold(p_hold_token uuid, p_session_id text, p_redemption_code text, p_booking_reference text DEFAULT NULL::text, p_event_metadata jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_session_id uuid;
  v_hold public.booking_claim_holds%rowtype;
  v_session public.offer_sessions%rowtype;
  v_offer public.merchant_offers%rowtype;
  v_redemption public.redemptions%rowtype;
  v_expiry timestamptz;
  v_start timestamptz;
  v_capacity jsonb;
begin
  select offer_session_id into v_session_id from public.booking_claim_holds where hold_token=p_hold_token and session_id=p_session_id;
  if not found then raise exception 'hold_not_found'; end if;

  select * into v_session from public.offer_sessions where id=v_session_id for update;
  select * into v_hold from public.booking_claim_holds where hold_token=p_hold_token and session_id=p_session_id for update;

  if v_hold.status='confirmed' and v_hold.redemption_id is not null then
    select * into v_redemption from public.redemptions where id=v_hold.redemption_id;
    return jsonb_build_object('ok',true,'reused',true,'redemption',to_jsonb(v_redemption),'capacity_remaining',v_session.capacity_remaining);
  end if;

  if v_hold.status='expired' or (v_hold.status='held' and v_hold.expires_at<=now()) then
    if v_hold.status='held' then
      update public.booking_claim_holds set status='expired',released_at=coalesce(released_at,now()),updated_at=now() where id=v_hold.id;
    end if;
    v_capacity:=public.reconcile_booking_session(v_session_id);
    return jsonb_build_object('ok',false,'error','hold_expired','capacity_remaining',(v_capacity->>'capacity_remaining')::integer);
  end if;

  if v_hold.status<>'held' then raise exception 'hold_not_active'; end if;

  select * into v_offer from public.merchant_offers where id=v_hold.merchant_offer_id and status='active' and action_type='booking_claim';
  if not found then raise exception 'booking_claim_not_available'; end if;

  v_start:=((v_session.service_date+v_session.service_start) at time zone v_session.timezone);
  v_expiry:=((v_session.service_date+v_session.service_end) at time zone v_session.timezone);

  insert into public.redemptions(merchant_id,merchant_offer_id,catalogue_item_id,redemption_code,session_id,status,party_size,commission_value,currency,expires_at,merchant_reference,metadata)
  values(v_offer.merchant_id,v_offer.id,v_offer.published_drop_id,p_redemption_code,p_session_id,'created',v_hold.party_size,0,'AUD',v_expiry,nullif(trim(p_booking_reference),''),
    jsonb_build_object('offer_title',v_offer.title,'offer_session_id',v_session.id,'service_date',v_session.service_date,'service_start',v_session.service_start,'service_end',v_session.service_end,'timezone',v_session.timezone,'valid_from',v_start,'valid_until',v_expiry,'booking_window_enforced',true,'booking_provider','nowbookit','booking_reference',nullif(trim(p_booking_reference),'')) || coalesce(p_event_metadata,'{}'::jsonb))
  returning * into v_redemption;

  update public.booking_claim_holds
     set status='confirmed',confirmed_at=now(),redemption_id=v_redemption.id,booking_reference=nullif(trim(p_booking_reference),''),metadata=metadata||coalesce(p_event_metadata,'{}'::jsonb),updated_at=now()
   where id=v_hold.id;

  v_capacity:=public.reconcile_booking_session(v_session_id);
  return jsonb_build_object('ok',true,'reused',false,'redemption',to_jsonb(v_redemption),'capacity_remaining',(v_capacity->>'capacity_remaining')::integer);
end;
$function$

CREATE OR REPLACE FUNCTION public.create_booking_hold(p_offer_id uuid, p_service_date date, p_session_id text, p_party_size integer, p_hold_minutes integer DEFAULT 10)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_offer public.merchant_offers%rowtype;
  v_session public.offer_sessions%rowtype;
  v_existing public.booking_claim_holds%rowtype;
  v_hold public.booking_claim_holds%rowtype;
  v_minutes integer := greatest(3,least(coalesce(p_hold_minutes,10),20));
begin
  if p_party_size is null or p_party_size<1 or p_party_size>6 then raise exception 'invalid_party_size'; end if;
  if coalesce(trim(p_session_id),'')='' or length(p_session_id)>120 then raise exception 'missing_session_id'; end if;

  select * into v_offer from public.merchant_offers
   where id=p_offer_id and status='active' and action_type='booking_claim';
  if not found then raise exception 'booking_claim_not_available'; end if;

  select * into v_session from public.offer_sessions
   where merchant_offer_id=p_offer_id and service_date=p_service_date and status='active'
   for update;
  if not found then raise exception 'session_not_available'; end if;
  if ((v_session.service_date+v_session.service_end) at time zone v_session.timezone)<=now() then raise exception 'session_not_available'; end if;

  perform public.reconcile_booking_session(v_session.id);
  select * into v_session from public.offer_sessions where id=v_session.id;

  select * into v_existing
  from public.booking_claim_holds
  where offer_session_id=v_session.id and session_id=p_session_id and status in ('held','confirmed')
  order by created_at desc limit 1
  for update;

  if found and v_existing.status='confirmed' then
    return jsonb_build_object('ok',true,'reused',true,'confirmed',true,'hold',to_jsonb(v_existing),'capacity_remaining',v_session.capacity_remaining);
  end if;

  if found and v_existing.status='held' then
    if v_existing.expires_at>now() and v_existing.party_size=p_party_size then
      return jsonb_build_object('ok',true,'reused',true,'confirmed',false,'hold',to_jsonb(v_existing),'capacity_remaining',v_session.capacity_remaining);
    end if;
    update public.booking_claim_holds set status='released',released_at=now(),updated_at=now() where id=v_existing.id;
    perform public.reconcile_booking_session(v_session.id);
    select * into v_session from public.offer_sessions where id=v_session.id;
  end if;

  if p_party_size>v_session.capacity_remaining then raise exception 'insufficient_capacity'; end if;

  update public.offer_sessions set capacity_remaining=capacity_remaining-p_party_size,updated_at=now()
   where id=v_session.id returning * into v_session;

  insert into public.booking_claim_holds(merchant_offer_id,offer_session_id,session_id,party_size,status,expires_at,metadata)
  values(p_offer_id,v_session.id,p_session_id,p_party_size,'held',now()+make_interval(mins=>v_minutes),
    jsonb_build_object('service_date',v_session.service_date,'timezone',v_session.timezone,'service_start',v_session.service_start,'service_end',v_session.service_end))
  returning * into v_hold;

  return jsonb_build_object('ok',true,'reused',false,'confirmed',false,'hold',to_jsonb(v_hold),'capacity_remaining',v_session.capacity_remaining);
end;
$function$

CREATE OR REPLACE FUNCTION public.reconcile_booking_session(p_session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_session public.offer_sessions%rowtype;
  v_active_holds integer := 0;
  v_active_claims integer := 0;
  v_remaining integer := 0;
begin
  select s.* into v_session
  from public.offer_sessions s
  join public.merchant_offers o on o.id=s.merchant_offer_id
  where s.id=p_session_id and o.action_type='booking_claim'
  for update of s;

  if not found then
    raise exception 'booking_session_not_found';
  end if;

  update public.booking_claim_holds
     set status='expired',
         released_at=coalesce(released_at,now()),
         updated_at=now()
   where offer_session_id=v_session.id
     and status='held'
     and expires_at<=now();

  update public.redemptions
     set status='expired', updated_at=now()
   where merchant_offer_id=v_session.merchant_offer_id
     and metadata->>'offer_session_id'=v_session.id::text
     and status='created'
     and expires_at is not null
     and expires_at<=now();

  select coalesce(sum(party_size),0)::integer into v_active_holds
  from public.booking_claim_holds
  where offer_session_id=v_session.id
    and status='held'
    and expires_at>now();

  select coalesce(sum(party_size),0)::integer into v_active_claims
  from public.redemptions
  where merchant_offer_id=v_session.merchant_offer_id
    and metadata->>'offer_session_id'=v_session.id::text
    and status in ('created','redeemed');

  v_remaining := greatest(0, v_session.capacity_total-v_active_holds-v_active_claims);

  update public.offer_sessions
     set capacity_remaining=v_remaining, updated_at=now()
   where id=v_session.id
   returning * into v_session;

  return jsonb_build_object(
    'session_id',v_session.id,
    'service_date',v_session.service_date,
    'capacity_total',v_session.capacity_total,
    'capacity_remaining',v_session.capacity_remaining,
    'active_hold_diners',v_active_holds,
    'active_claim_diners',v_active_claims
  );
end;
$function$

CREATE OR REPLACE FUNCTION public.reconcile_expired_booking_allocations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v record;
  v_count integer := 0;
begin
  for v in
    select s.id
    from public.offer_sessions s
    join public.merchant_offers o on o.id=s.merchant_offer_id
    where o.action_type='booking_claim' and o.status='active'
  loop
    perform public.reconcile_booking_session(v.id);
    v_count := v_count+1;
  end loop;
  return v_count;
end;
$function$

CREATE OR REPLACE FUNCTION public.redeem_merchant_redemption_with_spend(p_merchant_id uuid, p_redemption_code text, p_merchant_reference text DEFAULT NULL::text, p_eligible_food_subtotal numeric DEFAULT NULL::numeric)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_redemption public.redemptions%rowtype;
  v_offer public.merchant_offers%rowtype;
  v_term public.merchant_commercial_terms%rowtype;
  v_fee numeric := 0;
  v_discount numeric;
  v_now timestamptz := now();
begin
  if p_eligible_food_subtotal is not null and (p_eligible_food_subtotal < 0 or p_eligible_food_subtotal > 100000) then
    raise exception 'invalid_eligible_food_subtotal';
  end if;

  select * into v_redemption
  from public.redemptions
  where merchant_id = p_merchant_id
    and redemption_code = upper(trim(p_redemption_code))
  for update;

  if not found then raise exception 'redemption_not_found'; end if;
  if v_redemption.status <> 'created' then raise exception 'redemption_not_available'; end if;
  if v_redemption.expires_at is not null and v_redemption.expires_at < v_now then raise exception 'redemption_expired'; end if;

  if v_redemption.merchant_offer_id is not null then
    select * into v_offer
    from public.merchant_offers
    where id = v_redemption.merchant_offer_id
      and merchant_id = p_merchant_id;
  end if;

  if p_eligible_food_subtotal is not null then
    if found and v_offer.discount_type = 'percent' and v_offer.discount_percent is not null then
      v_discount := round(p_eligible_food_subtotal * (v_offer.discount_percent / 100), 2);
    else
      v_discount := v_redemption.discount_value;
    end if;
  else
    v_discount := v_redemption.discount_value;
  end if;

  select * into v_term
  from public.merchant_commercial_terms
  where merchant_id = p_merchant_id
    and status = 'active'
    and effective_from <= v_now
    and (effective_to is null or effective_to >= v_now)
  order by effective_from desc
  limit 1;

  if found then
    v_fee := coalesce(v_term.commission_flat,0) * v_redemption.party_size
      + coalesce(p_eligible_food_subtotal, v_redemption.gross_value, 0) * coalesce(v_term.commission_rate,0);
    v_fee := round(v_fee,2);
  end if;

  update public.redemptions
  set status = 'redeemed',
      redeemed_at = v_now,
      merchant_reference = nullif(trim(p_merchant_reference),''),
      gross_value = coalesce(p_eligible_food_subtotal, gross_value),
      discount_value = coalesce(v_discount, discount_value),
      commission_value = v_fee,
      metadata = metadata || jsonb_build_object(
        'merchant_redemption', jsonb_strip_nulls(jsonb_build_object(
          'eligible_food_subtotal', p_eligible_food_subtotal,
          'captured_at', v_now,
          'capture_method', 'merchant_portal'
        ))
      ),
      updated_at = v_now
  where id = v_redemption.id
  returning * into v_redemption;

  if v_fee > 0 then
    insert into public.commission_ledger (
      merchant_id, redemption_id, entry_type, gross_value, perkdrop_value,
      merchant_value, currency, status, occurred_at, metadata
    ) values (
      v_redemption.merchant_id, v_redemption.id, 'commission', v_redemption.gross_value, v_fee,
      case when v_redemption.gross_value is null then null else greatest(0,v_redemption.gross_value-v_fee) end,
      coalesce(v_redemption.currency,'AUD'), 'approved', v_now,
      jsonb_build_object(
        'party_size',v_redemption.party_size,
        'commercial_term_id',v_term.id,
        'merchant_offer_id',v_redemption.merchant_offer_id,
        'spend_captured', p_eligible_food_subtotal is not null
      )
    ) on conflict (redemption_id) where redemption_id is not null do nothing;
  end if;

  return to_jsonb(v_redemption);
end;
$function$

CREATE OR REPLACE FUNCTION public.release_booking_hold(p_hold_token uuid, p_session_id text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
declare
  v_session_id uuid;
  v_hold public.booking_claim_holds%rowtype;
  v_capacity jsonb;
begin
  select offer_session_id into v_session_id from public.booking_claim_holds where hold_token=p_hold_token and session_id=p_session_id;
  if not found then return jsonb_build_object('ok',true,'released',false); end if;

  perform 1 from public.offer_sessions where id=v_session_id for update;
  select * into v_hold from public.booking_claim_holds where hold_token=p_hold_token and session_id=p_session_id for update;
  if v_hold.status<>'held' then return jsonb_build_object('ok',true,'released',false,'status',v_hold.status); end if;

  update public.booking_claim_holds set status='released',released_at=now(),updated_at=now() where id=v_hold.id;
  v_capacity:=public.reconcile_booking_session(v_session_id);
  return jsonb_build_object('ok',true,'released',true,'capacity_remaining',(v_capacity->>'capacity_remaining')::integer);
end;
$function$

-- Live production privilege boundary: these RPCs are server-only.
revoke all on function public.claim_merchant_offer(uuid,text,text,integer,text),
  public.create_booking_hold(uuid,date,text,integer,integer),
  public.confirm_booking_hold(uuid,text,text,text,jsonb),
  public.release_booking_hold(uuid,text),
  public.reconcile_booking_session(uuid),
  public.reconcile_expired_booking_allocations(),
  public.redeem_merchant_redemption_with_spend(uuid,text,text,numeric)
  from public, anon, authenticated;
grant execute on function public.claim_merchant_offer(uuid,text,text,integer,text),
  public.create_booking_hold(uuid,date,text,integer,integer),
  public.confirm_booking_hold(uuid,text,text,text,jsonb),
  public.release_booking_hold(uuid,text),
  public.reconcile_booking_session(uuid),
  public.reconcile_expired_booking_allocations(),
  public.redeem_merchant_redemption_with_spend(uuid,text,text,numeric)
  to service_role;
