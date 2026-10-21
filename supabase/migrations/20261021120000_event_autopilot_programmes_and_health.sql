begin;
-- Keep one public programme card rather than one card for every future session.
create temporary table autopilot_duplicates on commit drop as
select id,first_value(id) over(partition by source,lower(btrim(title)) order by
  case when ends_at-starts_at<=interval '1 day' then 0 else 1 end,starts_at,id) as keeper,
  row_number() over(partition by source,lower(btrim(title)) order by
  case when ends_at-starts_at<=interval '1 day' then 0 else 1 end,starts_at,id) as position
from public.catalogue_items where id like 'AUTO-EVT3-%' and active;
update public.deal_candidates dc set published_drop_id=d.keeper,status='duplicate',updated_at=now()
from autopilot_duplicates d where d.position>1 and dc.published_drop_id=d.id;
update public.catalogue_items ci set active=false,lifecycle_status='withdrawn',updated_at=now(),
metadata=ci.metadata||jsonb_build_object('autopilot_duplicate_of',d.keeper)
from autopilot_duplicates d where d.position>1 and ci.id=d.id;

-- Reusable operational health, private to server-side administration.
create or replace view perkdrop_private.event_autopilot_health with(security_invoker=true) as
select now() as checked_at,
 (select max(finished_at) from public.event_watch_runs where details->>'version'='3' and details->>'profiled' is null) as last_completed_run,
 (select count(*) from public.merchant_sources where monitoring_enabled and authoritative and purpose='deal_monitoring') as monitored_sources,
 (select count(*) from public.merchant_sources where monitoring_enabled and authoritative and purpose='deal_monitoring' and coalesce(next_check_at,now())<now()-interval '1 hour') as overdue_sources,
 (select count(*) from public.catalogue_items where active and ends_at<=now()) as overdue_public_expiries,
 (select count(*) from public.deal_candidates where metadata->>'detected_by'='perkdrop-event-watch-v3' and status='needs_review' and ends_at>now()) as held_candidates,
 (select count(*) from public.catalogue_items where active and id like 'AUTO-EVT3-%') as auto_published_programmes;
revoke all on perkdrop_private.event_autopilot_health from public,anon,authenticated;
grant select on perkdrop_private.event_autopilot_health to service_role;
commit;
