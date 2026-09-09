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
