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
