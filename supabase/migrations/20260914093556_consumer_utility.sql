-- Public availability is reviewed evidence, not an inference from a title.
alter table public.catalogue_items add column if not exists availability jsonb not null default '{}';
alter table public.catalogue_items add column if not exists quality_grade text not null default 'C' check (quality_grade in ('A','B','C','D'));
alter table public.catalogue_items add column if not exists quality_note text;
alter table public.catalogue_items add constraint catalogue_availability_object check (jsonb_typeof(availability)='object');

create table public.listing_reports (
  id uuid primary key default gen_random_uuid(),
  catalogue_item_id text references public.catalogue_items(id),
  merchant_id uuid not null references public.merchants(id),
  reason text not null check(reason in ('unavailable','price','times','closed','location','other')),
  detail text not null default '' check(length(detail)<=1000),
  reporter_hash text not null check(length(reporter_hash)=64),
  status text not null default 'pending' check(status in ('pending','reviewing','resolved','dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz, reviewed_by uuid, review_note text check(length(review_note)<=1000)
);
alter table public.listing_reports enable row level security;
revoke all on public.listing_reports from public,anon,authenticated;
grant select,insert,update,delete on public.listing_reports to service_role;
create index listing_reports_actor_time on public.listing_reports(reporter_hash,created_at desc);
create index listing_reports_queue on public.listing_reports(status,created_at desc);

-- Service-only invoker RPC, serialized per pseudonymous reporter to prevent races.
create or replace function public.submit_listing_report(p_drop text,p_merchant uuid,p_reason text,p_detail text,p_hash text)
returns uuid language plpgsql security invoker set search_path=public,pg_temp as $$
declare mid uuid; result uuid;
begin
  if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'invalid_reporter'; end if;
  if p_reason is null or p_reason not in ('unavailable','price','times','closed','location','other') or length(coalesce(p_detail,''))>1000 then raise exception 'invalid_report'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_hash,917));
  if (select count(*) from listing_reports where reporter_hash=p_hash and created_at>now()-interval '1 hour')>=5 then raise exception 'report_rate_limit'; end if;
  if p_drop is not null then
    select merchant_id into mid from catalogue_items where id=p_drop and active;
  else mid:=p_merchant; end if;
  if mid is null or not exists(select 1 from merchants where id=mid and permanent_listing and directory_status<>'removed') then raise exception 'listing_not_found'; end if;
  select id into result from listing_reports where reporter_hash=p_hash and merchant_id=mid and catalogue_item_id is not distinct from p_drop and reason=p_reason and created_at>now()-interval '1 day' limit 1;
  if result is not null then return result; end if;
  insert into listing_reports(catalogue_item_id,merchant_id,reason,detail,reporter_hash) values(p_drop,mid,p_reason,coalesce(p_detail,''),p_hash) returning id into result;
  return result;
end $$;
revoke all on function public.submit_listing_report(text,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.submit_listing_report(text,uuid,text,text,text) to service_role;
comment on table public.listing_reports is 'Private staff review queue. Reports never automatically hide listings or notify businesses.';
