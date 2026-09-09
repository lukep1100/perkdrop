-- Local integration baseline exported read-only from production on 2026-09-09.
-- Core tables, CHECK/UNIQUE constraints and allocation/redemption RPCs only.
-- Geography is text here; discovery/PostGIS, external FKs and unrelated triggers are outside this suite.
create role anon; create role authenticated; create role service_role bypassrls;
-- demand_signals columns also checked against production 2026-09-09.
create table public.demand_signals (
  id uuid primary key default gen_random_uuid(),city text not null,vertical text not null default 'other',
  drop_type text not null default 'capacity',inventory_unit text not null default 'person',
  quantity integer not null default 1 check(quantity between 1 and 10000),source text not null default 'customer_request',
  status text not null default 'open' check(status in ('open','matched','expired','cancelled')),metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),expires_at timestamptz
);
create table public.booking_claim_holds (
id uuid not null default gen_random_uuid(),
hold_token uuid not null default gen_random_uuid(),
merchant_offer_id uuid not null,
offer_session_id uuid not null,
session_id text not null,
party_size integer not null,
status text not null default 'held'::text,
expires_at timestamp with time zone not null,
confirmed_at timestamp with time zone,
released_at timestamp with time zone,
redemption_id uuid,
booking_reference text,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);
create table public.catalogue_items (
id text not null,
merchant text not null,
title text not null,
description text not null,
category text not null,
kind text not null,
city text not null,
state text,
location text,
timing text,
end_date date,
price text,
conditions text,
booking boolean not null default false,
source text not null,
verified text,
hot boolean not null default false,
featured boolean not null default false,
slug text not null,
detail_url text not null,
city_label text,
active boolean not null default true,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
metadata jsonb not null default '{}'::jsonb,
latitude double precision,
longitude double precision,
image_url text,
image_alt text,
cuisine text,
discount_percent numeric(5,2),
venue_type text,
merchant_id uuid,
offer_origin text not null default 'public_source'::text,
exclusive boolean not null default false,
affiliate_url text,
affiliate_network text,
lifecycle_status text not null default 'active'::text,
expired_at timestamp with time zone,
last_verified_at timestamp with time zone,
location_geo text
);
create table public.commission_ledger (
id uuid not null default gen_random_uuid(),
merchant_id uuid not null,
redemption_id uuid,
conversion_id uuid,
entry_type text not null default 'commission'::text,
gross_value numeric(12,2),
perkdrop_value numeric(12,2) not null default 0,
merchant_value numeric(12,2),
currency text not null default 'AUD'::text,
status text not null default 'pending'::text,
occurred_at timestamp with time zone not null default now(),
payable_at timestamp with time zone,
paid_at timestamp with time zone,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);
create table public.merchant_commercial_terms (
id uuid not null default gen_random_uuid(),
merchant_id uuid not null,
model text not null default 'none'::text,
commission_flat numeric(12,2),
commission_rate numeric(7,4),
click_rate numeric(12,4),
monthly_fee numeric(12,2),
currency text not null default 'AUD'::text,
affiliate_network text,
affiliate_program_id text,
referral_tag text,
terms_url text,
status text not null default 'draft'::text,
effective_from timestamp with time zone,
effective_to timestamp with time zone,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);
create table public.merchant_members (
id uuid not null default gen_random_uuid(),
merchant_id uuid not null,
user_id uuid not null,
role text not null default 'owner'::text,
status text not null default 'active'::text,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);
create table public.merchant_offers (
id uuid not null default gen_random_uuid(),
merchant_id uuid not null,
created_by uuid,
published_drop_id text,
title text not null,
description text not null,
category text,
cuisine text,
venue_type text,
discount_type text not null default 'custom'::text,
discount_percent numeric(6,2),
normal_price numeric(12,2),
deal_price numeric(12,2),
promo_code text,
conditions text,
starts_at timestamp with time zone,
ends_at timestamp with time zone,
recurring_schedule jsonb not null default '{}'::jsonb,
capacity_total integer,
capacity_remaining integer,
redemption_limit_per_user integer,
location text,
city text,
state text,
latitude double precision,
longitude double precision,
booking_url text,
media_url text,
exclusive boolean not null default false,
featured boolean not null default false,
affiliate_url text,
affiliate_network text,
status text not null default 'draft'::text,
review_notes text,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
action_type text not null default 'redemption_code'::text,
vertical text not null default 'food'::text,
drop_type text not null default 'capacity'::text,
inventory_unit text not null default 'person'::text,
fulfilment_mode text not null default 'direct_claim'::text,
booking_provider text,
visibility text not null default 'public'::text,
market_id text
);
create table public.merchants (
id uuid not null default gen_random_uuid(),
name text not null,
slug text not null,
listing_status text not null default 'unclaimed'::text,
partner_tier text not null default 'none'::text,
claimable boolean not null default true,
description text,
cuisine text,
venue_type text,
primary_city text,
primary_state text,
primary_location text,
latitude double precision,
longitude double precision,
website_url text,
instagram_url text,
facebook_url text,
tiktok_url text,
public_phone text,
public_email text,
logo_url text,
hero_image_url text,
media_rights_confirmed boolean not null default false,
partner_since timestamp with time zone,
verified_at timestamp with time zone,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
market_id text,
business_category text,
parent_brand text,
location_label text,
permanent_listing boolean not null default true,
directory_status text not null default 'active'::text,
source_verified_at timestamp with time zone,
last_source_checked_at timestamp with time zone,
do_not_contact boolean not null default false,
location_geo text,
image_candidate_url text,
image_candidate_source_url text,
image_rights_status text not null default 'missing'::text,
source_confidence text not null default 'unverified'::text,
opening_hours jsonb not null default '{}'::jsonb,
booking_url text,
facilities jsonb not null default '[]'::jsonb
);
create table public.offer_sessions (
id uuid not null default gen_random_uuid(),
merchant_offer_id uuid not null,
service_date date not null,
timezone text not null default 'Australia/Adelaide'::text,
service_start time without time zone not null,
service_end time without time zone not null,
capacity_total integer not null,
capacity_remaining integer not null,
status text not null default 'active'::text,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now()
);
create table public.redemptions (
id uuid not null default gen_random_uuid(),
merchant_id uuid not null,
merchant_offer_id uuid,
catalogue_item_id text,
redemption_code text not null,
session_id text,
status text not null default 'created'::text,
gross_value numeric(12,2),
discount_value numeric(12,2),
commission_value numeric(12,2),
currency text not null default 'AUD'::text,
expires_at timestamp with time zone,
redeemed_at timestamp with time zone,
merchant_reference text,
metadata jsonb not null default '{}'::jsonb,
created_at timestamp with time zone not null default now(),
updated_at timestamp with time zone not null default now(),
party_size integer not null default 1
);
alter table public.booking_claim_holds add constraint "booking_claim_holds_hold_token_key" UNIQUE (hold_token);
alter table public.booking_claim_holds add constraint "booking_claim_holds_party_size_check" CHECK (((party_size >= 1) AND (party_size <= 20)));
alter table public.booking_claim_holds add constraint "booking_claim_holds_pkey" PRIMARY KEY (id);
alter table public.booking_claim_holds add constraint "booking_claim_holds_status_check" CHECK ((status = ANY (ARRAY['held'::text, 'confirmed'::text, 'released'::text, 'expired'::text, 'cancelled'::text])));
alter table public.catalogue_items add constraint "catalogue_items_discount_percent_check" CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))));
alter table public.catalogue_items add constraint "catalogue_items_latitude_check" CHECK (((latitude IS NULL) OR ((latitude >= ('-90'::integer)::double precision) AND (latitude <= (90)::double precision))));
alter table public.catalogue_items add constraint "catalogue_items_lifecycle_status_check" CHECK ((lifecycle_status = ANY (ARRAY['active'::text, 'expired'::text, 'paused'::text, 'withdrawn'::text])));
alter table public.catalogue_items add constraint "catalogue_items_longitude_check" CHECK (((longitude IS NULL) OR ((longitude >= ('-180'::integer)::double precision) AND (longitude <= (180)::double precision))));
alter table public.catalogue_items add constraint "catalogue_items_offer_origin_check" CHECK ((offer_origin = ANY (ARRAY['public_source'::text, 'merchant_submitted'::text, 'perkdrop_exclusive'::text, 'affiliate'::text])));
alter table public.catalogue_items add constraint "catalogue_items_pkey" PRIMARY KEY (id);
alter table public.catalogue_items add constraint "catalogue_items_slug_key" UNIQUE (slug);
alter table public.commission_ledger add constraint "commission_ledger_entry_type_check" CHECK ((entry_type = ANY (ARRAY['commission'::text, 'affiliate'::text, 'featured'::text, 'subscription'::text, 'adjustment'::text, 'refund'::text])));
alter table public.commission_ledger add constraint "commission_ledger_pkey" PRIMARY KEY (id);
alter table public.commission_ledger add constraint "commission_ledger_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'approved'::text, 'invoiced'::text, 'paid'::text, 'void'::text])));
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_click_rate_check" CHECK (((click_rate IS NULL) OR (click_rate >= (0)::numeric)));
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_commission_flat_check" CHECK (((commission_flat IS NULL) OR (commission_flat >= (0)::numeric)));
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_commission_rate_check" CHECK (((commission_rate IS NULL) OR ((commission_rate >= (0)::numeric) AND (commission_rate <= (1)::numeric))));
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_model_check" CHECK ((model = ANY (ARRAY['none'::text, 'cpa'::text, 'revenue_share'::text, 'cpc'::text, 'subscription'::text, 'affiliate'::text, 'hybrid'::text])));
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_monthly_fee_check" CHECK (((monthly_fee IS NULL) OR (monthly_fee >= (0)::numeric)));
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_pkey" PRIMARY KEY (id);
alter table public.merchant_commercial_terms add constraint "merchant_commercial_terms_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'active'::text, 'paused'::text, 'ended'::text])));
alter table public.merchant_members add constraint "merchant_members_merchant_id_user_id_key" UNIQUE (merchant_id, user_id);
alter table public.merchant_members add constraint "merchant_members_pkey" PRIMARY KEY (id);
alter table public.merchant_members add constraint "merchant_members_role_check" CHECK ((role = ANY (ARRAY['owner'::text, 'admin'::text, 'editor'::text, 'analyst'::text])));
alter table public.merchant_members add constraint "merchant_members_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'active'::text, 'suspended'::text])));
alter table public.merchant_offers add constraint "merchant_offers_action_type_check" CHECK ((action_type = ANY (ARRAY['redemption_code'::text, 'booking'::text, 'booking_claim'::text, 'ticket_link'::text, 'promo_code'::text, 'external_purchase'::text, 'affiliate_link'::text, 'in_store_claim'::text, 'free_claim'::text])));
alter table public.merchant_offers add constraint "merchant_offers_capacity_remaining_check" CHECK (((capacity_remaining IS NULL) OR (capacity_remaining >= 0)));
alter table public.merchant_offers add constraint "merchant_offers_capacity_total_check" CHECK (((capacity_total IS NULL) OR (capacity_total >= 0)));
alter table public.merchant_offers add constraint "merchant_offers_deal_price_check" CHECK (((deal_price IS NULL) OR (deal_price >= (0)::numeric)));
alter table public.merchant_offers add constraint "merchant_offers_discount_percent_check" CHECK (((discount_percent IS NULL) OR ((discount_percent >= (0)::numeric) AND (discount_percent <= (100)::numeric))));
alter table public.merchant_offers add constraint "merchant_offers_discount_type_check" CHECK ((discount_type = ANY (ARRAY['percent'::text, 'fixed'::text, 'deal_price'::text, 'free'::text, 'bogo'::text, 'custom'::text])));
alter table public.merchant_offers add constraint "merchant_offers_drop_type_check" CHECK ((drop_type = ANY (ARRAY['capacity'::text, 'cancellation'::text, 'last_minute'::text, 'exclusive'::text]))) NOT VALID;
alter table public.merchant_offers add constraint "merchant_offers_fulfilment_mode_check" CHECK ((fulfilment_mode = ANY (ARRAY['direct_claim'::text, 'booking_claim'::text, 'external_booking'::text, 'ticket'::text, 'appointment'::text, 'merchant_confirmation'::text, 'information_only'::text]))) NOT VALID;
alter table public.merchant_offers add constraint "merchant_offers_inventory_unit_check" CHECK ((inventory_unit = ANY (ARRAY['diner'::text, 'person'::text, 'ticket'::text, 'appointment'::text, 'booking'::text, 'room'::text, 'tee_time'::text, 'class_spot'::text, 'item'::text, 'package'::text, 'other'::text]))) NOT VALID;
alter table public.merchant_offers add constraint "merchant_offers_normal_price_check" CHECK (((normal_price IS NULL) OR (normal_price >= (0)::numeric)));
alter table public.merchant_offers add constraint "merchant_offers_pkey" PRIMARY KEY (id);
alter table public.merchant_offers add constraint "merchant_offers_redemption_limit_per_user_check" CHECK (((redemption_limit_per_user IS NULL) OR (redemption_limit_per_user > 0)));
alter table public.merchant_offers add constraint "merchant_offers_status_check" CHECK ((status = ANY (ARRAY['draft'::text, 'pending'::text, 'active'::text, 'paused'::text, 'expired'::text, 'rejected'::text])));
alter table public.merchant_offers add constraint "merchant_offers_vertical_check" CHECK ((vertical = ANY (ARRAY['food'::text, 'events'::text, 'beauty'::text, 'wellness'::text, 'experiences'::text, 'activities'::text, 'fitness'::text, 'stay'::text, 'shopping'::text, 'free'::text, 'other'::text]))) NOT VALID;
alter table public.merchant_offers add constraint "merchant_offers_visibility_check" CHECK ((visibility = ANY (ARRAY['public'::text, 'private'::text, 'invite_only'::text]))) NOT VALID;
alter table public.merchants add constraint "merchants_directory_status_check" CHECK ((directory_status = ANY (ARRAY['active'::text, 'temporarily_closed'::text, 'closed'::text, 'removed'::text])));
alter table public.merchants add constraint "merchants_image_rights_status_check" CHECK ((image_rights_status = ANY (ARRAY['missing'::text, 'candidate'::text, 'merchant_authorised'::text, 'licensed'::text, 'rejected'::text]))) NOT VALID;
alter table public.merchants add constraint "merchants_listing_status_check" CHECK ((listing_status = ANY (ARRAY['unclaimed'::text, 'claim_pending'::text, 'claimed'::text, 'verified'::text, 'partner'::text])));
alter table public.merchants add constraint "merchants_partner_tier_check" CHECK ((partner_tier = ANY (ARRAY['none'::text, 'performance'::text, 'featured'::text])));
alter table public.merchants add constraint "merchants_pkey" PRIMARY KEY (id);
alter table public.merchants add constraint "merchants_slug_key" UNIQUE (slug);
alter table public.merchants add constraint "merchants_source_confidence_check" CHECK ((source_confidence = ANY (ARRAY['unverified'::text, 'official_website'::text, 'government'::text, 'merchant_supplied'::text, 'verified_partner'::text]))) NOT VALID;
alter table public.offer_sessions add constraint "offer_sessions_capacity_remaining_check" CHECK ((capacity_remaining >= 0));
alter table public.offer_sessions add constraint "offer_sessions_capacity_total_check" CHECK (((capacity_total > 0) AND (capacity_total <= 10000)));
alter table public.offer_sessions add constraint "offer_sessions_check" CHECK ((capacity_remaining <= capacity_total));
alter table public.offer_sessions add constraint "offer_sessions_check1" CHECK ((service_end > service_start));
alter table public.offer_sessions add constraint "offer_sessions_merchant_offer_id_service_date_key" UNIQUE (merchant_offer_id, service_date);
alter table public.offer_sessions add constraint "offer_sessions_pkey" PRIMARY KEY (id);
alter table public.offer_sessions add constraint "offer_sessions_status_check" CHECK ((status = ANY (ARRAY['active'::text, 'closed'::text, 'cancelled'::text])));
alter table public.redemptions add constraint "redemptions_commission_value_check" CHECK (((commission_value IS NULL) OR (commission_value >= (0)::numeric)));
alter table public.redemptions add constraint "redemptions_discount_value_check" CHECK (((discount_value IS NULL) OR (discount_value >= (0)::numeric)));
alter table public.redemptions add constraint "redemptions_gross_value_check" CHECK (((gross_value IS NULL) OR (gross_value >= (0)::numeric)));
alter table public.redemptions add constraint "redemptions_party_size_positive" CHECK (((party_size >= 1) AND (party_size <= 10000)));
alter table public.redemptions add constraint "redemptions_pkey" PRIMARY KEY (id);
alter table public.redemptions add constraint "redemptions_redemption_code_key" UNIQUE (redemption_code);
alter table public.redemptions add constraint "redemptions_status_check" CHECK ((status = ANY (ARRAY['created'::text, 'redeemed'::text, 'expired'::text, 'cancelled'::text, 'refunded'::text])));
create unique index commission_ledger_one_entry_per_redemption on public.commission_ledger(redemption_id) where redemption_id is not null;
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
;
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
;
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
;
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
;
CREATE OR REPLACE FUNCTION public.redeem_merchant_redemption(p_merchant_id uuid, p_redemption_code text, p_merchant_reference text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_redemption public.redemptions%rowtype;
  v_term public.merchant_commercial_terms%rowtype;
  v_fee numeric := 0;
  v_now timestamptz := now();
begin
  select * into v_redemption from public.redemptions
    where merchant_id=p_merchant_id and redemption_code=p_redemption_code
    for update;
  if not found then raise exception 'redemption_not_found'; end if;
  if v_redemption.status <> 'created' then raise exception 'redemption_not_available'; end if;
  if v_redemption.expires_at is not null and v_redemption.expires_at < v_now then raise exception 'redemption_expired'; end if;

  select * into v_term from public.merchant_commercial_terms
    where merchant_id=p_merchant_id and status='active' and effective_from <= v_now
      and (effective_to is null or effective_to >= v_now)
    order by effective_from desc limit 1;

  if found then
    v_fee := coalesce(v_term.commission_flat,0) * v_redemption.party_size
      + coalesce(v_redemption.gross_value,0) * coalesce(v_term.commission_rate,0);
    v_fee := round(v_fee,2);
  end if;

  update public.redemptions set status='redeemed', redeemed_at=v_now,
    merchant_reference=nullif(p_merchant_reference,''), commission_value=v_fee, updated_at=v_now
    where id=v_redemption.id returning * into v_redemption;

  if v_fee > 0 then
    insert into public.commission_ledger (
      merchant_id,redemption_id,entry_type,gross_value,perkdrop_value,merchant_value,currency,status,occurred_at,metadata
    ) values (
      v_redemption.merchant_id,v_redemption.id,'commission',v_redemption.gross_value,v_fee,
      case when v_redemption.gross_value is null then null else greatest(0,v_redemption.gross_value-v_fee) end,
      coalesce(v_redemption.currency,'AUD'),'approved',v_now,
      jsonb_build_object('party_size',v_redemption.party_size,'commercial_term_id',v_term.id,'merchant_offer_id',v_redemption.merchant_offer_id)
    ) on conflict (redemption_id) where redemption_id is not null do nothing;
  end if;
  return to_jsonb(v_redemption);
end;
$function$
;
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
;
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
;
revoke all on all functions in schema public from public,anon,authenticated;
grant execute on all functions in schema public to service_role;
grant all on all tables in schema public to service_role;
