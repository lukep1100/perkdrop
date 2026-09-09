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
