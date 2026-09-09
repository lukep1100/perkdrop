-- One allocation ledger: live holds + live/redeemed passes, per service.
alter table public.engagement_events drop constraint engagement_events_event_type_check;
alter table public.engagement_events add constraint engagement_events_event_type_check check
  (event_type in ('impression','deal_view','listing_view','website_click','directions','call','save','share',
  'claim_start','claim_submit','redemption_start','redemption_complete','booking_start','booking_complete',
  'page_view','deal_open','search','save_toggle','map_open','directions_click','official_deal_click',
  'business_submit_started','business_submit_completed','claim_portal_open','service_selected','party_selected',
  'hold_created','hold_expired','hold_released','claim_issued','book_table_click','booking_claim_confirmed'));
alter table public.outbound_clicks add column metadata jsonb not null default '{}'::jsonb;
-- All callable mutation functions below are server-only SECURITY INVOKER.
-- Redeemed diners remain consumed; cancelled/refunded/expired passes do not.
create function public.booking_allocated_diners(p_session uuid)
returns integer language sql volatile security invoker set search_path = ''
as $$
  select (
    coalesce((select sum(h.party_size) from public.booking_claim_holds h
      where h.offer_session_id=p_session and h.status='held'
        and h.expires_at>clock_timestamp() and h.redemption_id is null),0)
    + coalesce((select sum(r.party_size) from public.redemptions r
      where r.metadata->>'offer_session_id'=p_session::text
        and (r.status='redeemed' or (r.status='created'
          and (r.expires_at is null or r.expires_at>clock_timestamp())))),0)
  )::integer;
$$;

create function public.sync_booking_capacity(p_session uuid)
returns integer language plpgsql security invoker set search_path = ''
as $$
declare v_total integer; v_used integer;
begin
  select capacity_total into v_total from public.offer_sessions where id=p_session for update;
  if not found then return null; end if;
  v_used:=public.booking_allocated_diners(p_session);
  if v_used>v_total then raise exception 'insufficient_capacity'; end if;
  update public.offer_sessions set capacity_remaining=v_total-v_used,updated_at=clock_timestamp()
    where id=p_session and capacity_remaining is distinct from v_total-v_used;
  return v_total-v_used;
end;
$$;

create function public.booking_allocation_changed()
returns trigger language plpgsql security invoker set search_path = ''
as $$
declare v_old uuid; v_new uuid; v_id uuid;
begin
  if tg_table_name='booking_claim_holds' then
    if tg_op<>'INSERT' then v_old:=old.offer_session_id; end if;
    if tg_op<>'DELETE' then v_new:=new.offer_session_id; end if;
  else
    if tg_op<>'INSERT' then v_old:=nullif(old.metadata->>'offer_session_id','')::uuid; end if;
    if tg_op<>'DELETE' then v_new:=nullif(new.metadata->>'offer_session_id','')::uuid; end if;
  end if;
  for v_id in select distinct x from unnest(array[v_old,v_new]) x where x is not null order by x loop
    perform public.sync_booking_capacity(v_id);
  end loop;
  return null;
end;
$$;

create trigger booking_hold_capacity_changed after insert or update or delete
on public.booking_claim_holds for each row execute function public.booking_allocation_changed();
create trigger booking_pass_capacity_changed after insert or update or delete
on public.redemptions for each row execute function public.booking_allocation_changed();

-- Even a privileged direct edit to the cache cannot invent availability.
create function public.booking_capacity_cache_guard()
returns trigger language plpgsql security invoker set search_path = ''
as $$
begin
  new.capacity_remaining:=new.capacity_total-public.booking_allocated_diners(new.id);
  if new.capacity_remaining<0 then raise exception 'insufficient_capacity'; end if;
  return new;
end;
$$;
create trigger booking_capacity_cache_guard before insert or update of capacity_remaining,capacity_total
on public.offer_sessions for each row execute function public.booking_capacity_cache_guard();

create function public.reconcile_booking_session(p_session uuid)
returns integer language plpgsql security invoker set search_path = ''
as $$
begin
  perform 1 from public.offer_sessions where id=p_session for update;
  if not found then return null; end if;
  with expired as (
    update public.booking_claim_holds set status='expired',released_at=clock_timestamp(),updated_at=clock_timestamp()
      where offer_session_id=p_session and status='held' and expires_at<=clock_timestamp()
      returning *
  )
  insert into public.engagement_events(merchant_offer_id,event_type,session_id,metadata)
    select merchant_offer_id,'hold_expired',session_id,
      metadata||jsonb_build_object('hold_id',id,'party_size',party_size)
    from expired;
  update public.redemptions set status='expired'
    where metadata->>'offer_session_id'=p_session::text and status='created' and expires_at<=clock_timestamp();
  update public.booking_claim_holds h set status='released',released_at=clock_timestamp()
    where h.offer_session_id=p_session and h.status='confirmed' and exists (
      select 1 from public.redemptions r where r.id=h.redemption_id and r.status in ('expired','cancelled','refunded'));
  return public.sync_booking_capacity(p_session);
end;
$$;

create function public.booking_service_is_claimable(p_session uuid)
returns boolean language sql stable security invoker set search_path = ''
as $$
  select coalesce(bool_and(
    s.status='active' and o.status='active' and o.action_type='booking_claim'
    and (s.service_date+s.service_end) at time zone s.timezone>now()
    and (o.ends_at is null or o.ends_at>now())
    and (o.starts_at is null or (s.service_date+s.service_end) at time zone s.timezone>o.starts_at)
    and (o.ends_at is null or (s.service_date+s.service_start) at time zone s.timezone<o.ends_at)
    and (o.recurring_schedule->'days' is null or
      (o.recurring_schedule->'days') ? lower(trim(to_char(s.service_date,'Day'))))
  ),false) from public.offer_sessions s join public.merchant_offers o on o.id=s.merchant_offer_id
  where s.id=p_session;
$$;

create function public.booking_availability(p_offer_id uuid default null)
returns setof public.offer_sessions language plpgsql security invoker set search_path = ''
as $$
declare v_id uuid;
begin
  for v_id in select s.id from public.offer_sessions s join public.merchant_offers o on o.id=s.merchant_offer_id
    where o.action_type='booking_claim' and (p_offer_id is null or o.id=p_offer_id)
    order by s.id
  loop perform public.reconcile_booking_session(v_id); end loop;
  return query select s.* from public.offer_sessions s
    where (p_offer_id is null or s.merchant_offer_id=p_offer_id)
      and public.booking_service_is_claimable(s.id)
    order by s.service_date,s.service_start;
end;
$$;

create or replace function public.create_booking_hold(p_offer_id uuid,p_service_date date,p_session_id text,p_party_size integer,p_hold_minutes integer default 10)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare s public.offer_sessions%rowtype; h public.booking_claim_holds%rowtype; r public.redemptions%rowtype; v_left integer;
begin
  if p_party_size is null or p_party_size not between 1 and 6 then raise exception 'invalid_party_size'; end if;
  if coalesce(p_session_id,'') !~ '^[a-zA-Z0-9:_-]{12,120}$' then raise exception 'missing_session_id'; end if;
  select * into s from public.offer_sessions where merchant_offer_id=p_offer_id and service_date=p_service_date for update;
  if not found then raise exception 'session_not_available'; end if;
  v_left:=public.reconcile_booking_session(s.id);
  if not public.booking_service_is_claimable(s.id) then raise exception 'session_not_available'; end if;
  select * into r from public.redemptions where merchant_offer_id=p_offer_id and session_id=p_session_id
    and metadata->>'offer_session_id'=s.id::text
    and (status='redeemed' or (status='created' and expires_at>clock_timestamp()))
    order by created_at desc limit 1;
  if found then return jsonb_build_object('reused',true,'confirmed',true,'redemption',to_jsonb(r),'capacity_remaining',v_left); end if;
  select * into h from public.booking_claim_holds where offer_session_id=s.id and session_id=p_session_id
    and status='held' and expires_at>clock_timestamp() order by created_at desc limit 1;
  if found then
    if h.party_size=p_party_size then
      return jsonb_build_object('reused',true,'confirmed',false,'hold',to_jsonb(h),'capacity_remaining',v_left);
    end if;
    update public.booking_claim_holds set status='released',released_at=clock_timestamp() where id=h.id;
    v_left:=public.sync_booking_capacity(s.id);
  end if;
  if p_party_size>v_left then raise exception 'insufficient_capacity'; end if;
  insert into public.booking_claim_holds(merchant_offer_id,offer_session_id,session_id,party_size,status,expires_at,metadata)
    values(p_offer_id,s.id,p_session_id,p_party_size,'held',
      least(clock_timestamp()+make_interval(mins=>greatest(3,least(coalesce(p_hold_minutes,10),20))),
        (s.service_date+s.service_end) at time zone s.timezone),
      jsonb_build_object('service_date',s.service_date,'timezone',s.timezone,'service_start',s.service_start,'service_end',s.service_end))
    returning * into h;
  return jsonb_build_object('reused',false,'confirmed',false,'hold',to_jsonb(h),'capacity_remaining',public.sync_booking_capacity(s.id));
end;
$$;

create or replace function public.release_booking_hold(p_hold_token uuid,p_session_id text)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare h public.booking_claim_holds%rowtype; v_left integer; v_released boolean:=false;
begin
  select * into h from public.booking_claim_holds where hold_token=p_hold_token and session_id=p_session_id;
  if not found then return jsonb_build_object('ok',true,'released',false); end if;
  perform 1 from public.offer_sessions where id=h.offer_session_id for update;
  perform public.reconcile_booking_session(h.offer_session_id);
  update public.booking_claim_holds set status='released',released_at=clock_timestamp(),updated_at=clock_timestamp()
    where id=h.id and status='held';
  v_released:=found;
  v_left:=public.sync_booking_capacity(h.offer_session_id);
  return jsonb_build_object('ok',true,'released',v_released,'capacity_remaining',v_left);
end;
$$;

create or replace function public.confirm_booking_hold(p_hold_token uuid,p_session_id text,p_redemption_code text,p_booking_reference text default null,p_event_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare h public.booking_claim_holds%rowtype; s public.offer_sessions%rowtype; o public.merchant_offers%rowtype; r public.redemptions%rowtype; v_meta jsonb;
begin
  select * into h from public.booking_claim_holds where hold_token=p_hold_token and session_id=p_session_id;
  if not found then raise exception 'hold_not_found'; end if;
  select * into s from public.offer_sessions where id=h.offer_session_id for update;
  perform public.reconcile_booking_session(s.id);
  select * into h from public.booking_claim_holds where id=h.id;
  if h.status='confirmed' and h.redemption_id is not null then
    select * into r from public.redemptions where id=h.redemption_id;
    return jsonb_build_object('reused',true,'redemption',to_jsonb(r),'capacity_remaining',public.sync_booking_capacity(s.id));
  end if;
  -- Return errors rather than raising after cleanup, so cleanup commits.
  if h.status='expired' or h.expires_at<=clock_timestamp() then return jsonb_build_object('error','hold_expired'); end if;
  if h.status<>'held' then return jsonb_build_object('error','hold_not_active'); end if;
  if not public.booking_service_is_claimable(s.id) then return jsonb_build_object('error','session_not_available'); end if;
  select * into o from public.merchant_offers where id=h.merchant_offer_id;
  v_meta:=coalesce(p_event_metadata,'{}'::jsonb)||jsonb_build_object(
    'offer_title',o.title,'offer_session_id',s.id,'service_date',s.service_date,'service_start',s.service_start,
    'service_end',s.service_end,'timezone',s.timezone,
    'valid_from',(s.service_date+s.service_start) at time zone s.timezone,
    'valid_until',(s.service_date+s.service_end) at time zone s.timezone,
    'booking_window_enforced',true,'table_booking_required',true);
  -- Remove the hold allocation before creating its pass; the session lock spans both.
  update public.booking_claim_holds set status='confirmed',confirmed_at=clock_timestamp(),updated_at=clock_timestamp() where id=h.id;
  insert into public.redemptions(merchant_id,merchant_offer_id,catalogue_item_id,redemption_code,session_id,status,party_size,
    commission_value,currency,expires_at,merchant_reference,metadata)
    values(o.merchant_id,o.id,o.published_drop_id,p_redemption_code,p_session_id,'created',h.party_size,0,'AUD',
      (s.service_date+s.service_end) at time zone s.timezone,nullif(p_booking_reference,''),v_meta)
    returning * into r;
  update public.booking_claim_holds set redemption_id=r.id,metadata=metadata||v_meta where id=h.id;
  insert into public.engagement_events(merchant_id,merchant_offer_id,catalogue_item_id,event_type,session_id,source_page,metadata)
    values(o.merchant_id,o.id,o.published_drop_id,'claim_issued',p_session_id,v_meta->>'source_page',
      v_meta||jsonb_build_object('redemption_id',r.id,'party_size',h.party_size));
  return jsonb_build_object('reused',false,'redemption',to_jsonb(r),'capacity_remaining',public.sync_booking_capacity(s.id));
end;
$$;

create function public.reserve_booking_perk(p_offer_id uuid,p_service_date date,p_session_id text,p_party_size integer,p_redemption_code text,p_metadata jsonb default '{}'::jsonb)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare v_hold jsonb; v_result jsonb; o public.merchant_offers%rowtype;
begin
  v_hold:=public.create_booking_hold(p_offer_id,p_service_date,p_session_id,p_party_size,10);
  if (v_hold->>'confirmed')::boolean then
    return jsonb_build_object('reused',true,'redemption',v_hold->'redemption','capacity_remaining',v_hold->'capacity_remaining');
  end if;
  if not (v_hold->>'reused')::boolean then
    select * into o from public.merchant_offers where id=p_offer_id;
    insert into public.engagement_events(merchant_id,merchant_offer_id,catalogue_item_id,event_type,session_id,source_page,metadata)
      values(o.merchant_id,o.id,o.published_drop_id,'hold_created',p_session_id,p_metadata->>'source_page',
        coalesce(p_metadata,'{}')||jsonb_build_object('hold_id',v_hold#>>'{hold,id}','party_size',p_party_size,'service_date',p_service_date));
  end if;
  v_result:=public.confirm_booking_hold((v_hold#>>'{hold,hold_token}')::uuid,p_session_id,p_redemption_code,null,p_metadata);
  return v_result;
end;
$$;

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
  v_booking_date date;
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

  if v_offer.action_type='booking_claim' then
    if p_party_size>6 then raise exception 'invalid_party_size'; end if;
    select s.service_date into v_booking_date from public.booking_availability(v_offer.id) s
      where s.capacity_remaining>=p_party_size or exists (
        select 1 from public.redemptions r where r.merchant_offer_id=v_offer.id
        and r.session_id=p_session_id and r.metadata->>'offer_session_id'=s.id::text
        and r.status in ('created','redeemed') and r.expires_at>clock_timestamp())
      order by s.service_date limit 1;
    if v_booking_date is null then raise exception 'no_eligible_service'; end if;
    return public.reserve_booking_perk(v_offer.id,v_booking_date,p_session_id,p_party_size,p_redemption_code,'{}');
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


create index redemptions_service_allocation_idx on public.redemptions ((metadata->>'offer_session_id'),status);

-- Explicit server-only access, including legacy RPCs which previously granted PUBLIC.
revoke all on function public.booking_allocated_diners(uuid),public.sync_booking_capacity(uuid),
  public.booking_allocation_changed(),public.booking_capacity_cache_guard(),public.reconcile_booking_session(uuid),
  public.booking_service_is_claimable(uuid),public.booking_availability(uuid),
  public.create_booking_hold(uuid,date,text,integer,integer),public.release_booking_hold(uuid,text),
  public.confirm_booking_hold(uuid,text,text,text,jsonb),public.reserve_booking_perk(uuid,date,text,integer,text,jsonb)
  from public,anon,authenticated;
grant execute on function public.booking_allocated_diners(uuid),public.sync_booking_capacity(uuid),
  public.booking_allocation_changed(),public.booking_capacity_cache_guard(),public.reconcile_booking_session(uuid),
  public.booking_service_is_claimable(uuid),public.booking_availability(uuid),
  public.create_booking_hold(uuid,date,text,integer,integer),public.release_booking_hold(uuid,text),
  public.confirm_booking_hold(uuid,text,text,text,jsonb),public.reserve_booking_perk(uuid,date,text,integer,text,jsonb)
  to service_role;

-- Reconcile from actual allocations; never reset sessions blindly.
revoke all on public.offer_sessions,public.booking_claim_holds from anon,authenticated;
select count(*) from public.booking_availability(null);
select cron.schedule('perkdrop-booking-expiry-minute','* * * * *','select count(*) from public.booking_availability(null);');
