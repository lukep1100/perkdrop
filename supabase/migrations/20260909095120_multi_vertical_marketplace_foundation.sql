-- PerkDrop multi-vertical marketplace foundation.
-- Additive only: existing offer/session/redemption flows remain compatible.

alter table public.merchant_offers
  add column if not exists vertical text not null default 'food',
  add column if not exists drop_type text not null default 'capacity',
  add column if not exists inventory_unit text not null default 'person',
  add column if not exists fulfilment_mode text not null default 'direct_claim',
  add column if not exists booking_provider text,
  add column if not exists visibility text not null default 'public',
  add column if not exists market_id text;

alter table public.merchant_offers
  add constraint merchant_offers_vertical_check
    check (vertical in ('food','events','beauty','wellness','experiences','activities','fitness','stay','shopping','free','other'))
    not valid,
  add constraint merchant_offers_drop_type_check
    check (drop_type in ('capacity','cancellation','last_minute','exclusive'))
    not valid,
  add constraint merchant_offers_inventory_unit_check
    check (inventory_unit in ('diner','person','ticket','appointment','booking','room','tee_time','class_spot','item','package','other'))
    not valid,
  add constraint merchant_offers_fulfilment_mode_check
    check (fulfilment_mode in ('direct_claim','booking_claim','external_booking','ticket','appointment','merchant_confirmation','information_only'))
    not valid,
  add constraint merchant_offers_visibility_check
    check (visibility in ('public','private','invite_only'))
    not valid;

alter table public.merchant_offers
  add constraint merchant_offers_market_fk
    foreign key (market_id) references public.markets(id)
    not valid;

alter table public.email_subscribers
  add column if not exists preferences jsonb not null default '{}'::jsonb;

alter table public.markets
  add column if not exists parent_market_id text,
  add column if not exists market_type text not null default 'city';

alter table public.markets
  add constraint markets_parent_market_fk
    foreign key (parent_market_id) references public.markets(id)
    not valid,
  add constraint markets_market_type_check
    check (market_type in ('city','precinct','region'))
    not valid;

create index if not exists merchant_offers_vertical_drop_type_idx
  on public.merchant_offers (vertical, drop_type, status);
create index if not exists merchant_offers_market_active_idx
  on public.merchant_offers (market_id, status, starts_at, ends_at);
create index if not exists merchant_offers_fulfilment_mode_idx
  on public.merchant_offers (fulfilment_mode, booking_provider);
create index if not exists markets_parent_active_idx
  on public.markets (parent_market_id, active);
create index if not exists email_subscribers_preferences_gin_idx
  on public.email_subscribers using gin (preferences);

-- Canonical urgency language for server-rendered consumers and future clients.
create or replace function public.drop_urgency_label(
  p_capacity_remaining integer,
  p_ends_at timestamptz default null,
  p_drop_type text default null
) returns text
language plpgsql
stable
security invoker
set search_path = ''
as $$
begin
  if p_capacity_remaining is not null then
    if p_capacity_remaining <= 0 then return 'SOLD OUT'; end if;
    if p_capacity_remaining <= 3 then return 'ONLY ' || p_capacity_remaining || ' LEFT'; end if;
    if p_capacity_remaining <= 8 then return 'LIMITED — ' || p_capacity_remaining || ' LEFT'; end if;
  end if;
  if p_drop_type = 'cancellation' then return 'CANCELLATION DROP'; end if;
  if p_drop_type = 'last_minute' then return 'LAST MINUTE'; end if;
  if p_ends_at is not null and p_ends_at <= now() + interval '24 hours' then return 'ENDING SOON'; end if;
  return null;
end;
$$;

revoke all on function public.drop_urgency_label(integer,timestamptz,text) from public, anon, authenticated;
grant execute on function public.drop_urgency_label(integer,timestamptz,text) to service_role;
