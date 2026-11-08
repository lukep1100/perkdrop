begin;
-- Extend the existing hourly maintenance; retain expiry/source policy and private access.
CREATE OR REPLACE FUNCTION perkdrop_private.maintain_event_watch()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY INVOKER
 SET search_path TO 'public', 'perkdrop_private', 'pg_temp'
AS $function$
declare
  expired_candidates integer := 0;
  disabled_dead_sources integer := 0;
  stalled_runs integer := 0;
begin
  update public.deal_candidates
     set status='expired', reviewed_at=coalesce(reviewed_at,now()), updated_at=now(),
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('expired_automatically_at',now())
   where candidate_type='event'
     and status in ('new','needs_review','approved')
     and coalesce(ends_at,starts_at) is not null
     and coalesce(ends_at,starts_at) < now() - interval '6 hours';
  get diagnostics expired_candidates = row_count;

  update public.merchant_sources
     set monitoring_enabled=false, updated_at=now(),
         metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('monitoring_disabled_reason','repeated_dead_source','monitoring_disabled_at',now())
   where purpose='deal_monitoring'
     and monitoring_enabled=true
     and last_http_status in (404,410)
     and consecutive_failures>=3;
  get diagnostics disabled_dead_sources = row_count;

  -- Empty abandoned runs have unknown outcomes, never successful completion.
  -- v3 handlers normally finish within minutes; editorial work gets a full day.
  update public.event_watch_runs
     set finished_at=now(), failures=failures+1,
         details=details||jsonb_build_object(
           'status','stalled','stalled_at',now(),
           'closure_reason','maintenance_timeout',
           'outcome','unknown',
           'timeout_hours',case when details->>'version'='3' then 2 else 24 end)
   where finished_at is null
     and sources_checked=0 and sources_changed=0 and events_detected=0
     and candidates_created=0 and auto_published=0
     and (
       (details->>'version'='3' and started_at < now()-interval '2 hours')
       or (details->>'version'='5' and details->>'scope'='national_editorial_cycle'
           and started_at < now()-interval '24 hours')
     );
  get diagnostics stalled_runs = row_count;

  return jsonb_build_object('stalled_runs',stalled_runs,'expired_candidates',expired_candidates,'disabled_dead_sources',disabled_dead_sources,'ran_at',now());
end;
$function$;

revoke all on function perkdrop_private.maintain_event_watch() from public,anon,authenticated,service_role;

-- A timeout closure must never make discovery health look freshly completed.
create or replace view perkdrop_private.event_autopilot_health with (security_invoker=true) as
 SELECT now() AS checked_at,
    ( SELECT max(event_watch_runs.finished_at) AS max
           FROM event_watch_runs
          WHERE (event_watch_runs.details ->> 'version'::text) = '3'::text AND (event_watch_runs.details ->> 'profiled'::text) IS NULL
            AND coalesce(event_watch_runs.details->>'status','') not in ('stalled','running','failed')) AS last_completed_run,
    ( SELECT count(*) AS count
           FROM merchant_sources
          WHERE merchant_sources.monitoring_enabled AND merchant_sources.authoritative AND merchant_sources.purpose = 'deal_monitoring'::text) AS monitored_sources,
    ( SELECT count(*) AS count
           FROM merchant_sources
          WHERE merchant_sources.monitoring_enabled AND merchant_sources.authoritative AND merchant_sources.purpose = 'deal_monitoring'::text AND COALESCE(merchant_sources.next_check_at, now()) < (now() - '01:00:00'::interval)) AS overdue_sources,
    ( SELECT count(*) AS count
           FROM catalogue_items
          WHERE catalogue_items.active AND catalogue_items.ends_at <= now()) AS overdue_public_expiries,
    ( SELECT count(*) AS count
           FROM deal_candidates
          WHERE (deal_candidates.metadata ->> 'detected_by'::text) = 'perkdrop-event-watch-v3'::text AND deal_candidates.status = 'needs_review'::text AND deal_candidates.ends_at > now()) AS held_candidates,
    ( SELECT count(*) AS count
           FROM catalogue_items
          WHERE catalogue_items.active AND catalogue_items.id ~~ 'AUTO-EVT3-%'::text) AS auto_published_programmes;
revoke all on perkdrop_private.event_autopilot_health from public,anon,authenticated;
grant select on perkdrop_private.event_autopilot_health to service_role;
commit;
