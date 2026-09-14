-- Approval transport only. This migration never enables sending or releases backlog.
alter table public.merchant_notification_outbox
  drop constraint merchant_notification_outbox_status_check,
  add constraint merchant_notification_outbox_status_check
    check (status in ('pending','processing','provider_accepted','delivery_unknown','sent','failed','skipped')),
  add column provider_message_id text,
  add column provider_accepted_at timestamptz,
  add column first_attempt_at timestamptz,
  add column next_attempt_at timestamptz,
  add column provider_request jsonb;
alter table public.merchant_notification_config
  add column release_after timestamptz,
  add column released_event_types text[] not null default '{}';
comment on column public.merchant_notification_config.release_after is
  'Explicit operator-approved release boundary. Earlier backlog is never released by enabling the sender.';
comment on column public.merchant_notification_outbox.provider_accepted_at is
  'API acceptance only: not recipient-server delivery, inbox receipt or link use. Legacy sent is also unverified.';
alter table public.merchant_notification_outbox enable row level security;
alter table public.merchant_notification_config enable row level security;
revoke all on public.merchant_notification_outbox,public.merchant_notification_config from anon,authenticated;
grant all on public.merchant_notification_outbox,public.merchant_notification_config to service_role;
create index merchant_notification_pending_due_idx on public.merchant_notification_outbox(next_attempt_at,created_at)
  where status='pending';

create or replace function public.claim_merchant_notifications(p_limit integer default 20)
returns setof public.merchant_notification_outbox language plpgsql security definer
set search_path=public,pg_temp as $$
begin
  if not exists(select 1 from public.merchant_notification_config
    where singleton and enabled and release_after is not null and cardinality(released_event_types)>0)
  then return; end if;
  -- Never retry outside the provider's 24-hour idempotency window or after five leases.
  -- Uncertain attempts require provider reconciliation, not a fresh send.
  update public.merchant_notification_outbox
    set status='delivery_unknown',processing_started_at=null,last_error='retry_boundary_requires_provider_reconciliation'
    where (status='pending' or (status='processing' and processing_started_at<now()-interval '10 minutes'))
      and attempt_count>0 and (attempt_count>=5 or first_attempt_at is null or first_attempt_at<=now()-interval '23 hours');
  update public.merchant_notification_outbox
    set status='pending',processing_started_at=null,next_attempt_at=now(),last_error='stale_lease_recovered'
    where status='processing' and processing_started_at<now()-interval '10 minutes';
  return query
  with picked as (
    select o.id from public.merchant_notification_outbox o
    cross join public.merchant_notification_config c
    where c.singleton and c.enabled and c.release_after is not null
      and o.created_at>=c.release_after and o.event_type=any(c.released_event_types)
      and o.status='pending' and o.attempt_count<5
      and (o.next_attempt_at is null or o.next_attempt_at<=now())
      and (o.attempt_count=0 or o.first_attempt_at>now()-interval '23 hours')
    order by o.created_at for update of o skip locked limit greatest(0,least(coalesce(p_limit,20),20))
  )
  update public.merchant_notification_outbox o
    set status='processing',attempt_count=o.attempt_count+1,
      first_attempt_at=coalesce(o.first_attempt_at,now()),processing_started_at=now(),last_error=null
    from picked p where o.id=p.id returning o.*;
end $$;

create or replace function public.merchant_notification_send_allowed(p_id uuid)
returns boolean language sql stable security definer set search_path=public,pg_temp as $$
  select exists(
    select 1 from public.merchant_notification_outbox o
    join public.merchant_notification_config c on c.singleton
    join public.merchants m on m.id=o.merchant_id
    where o.id=p_id and o.status='processing' and o.processing_started_at>now()-interval '10 minutes'
      and o.first_attempt_at>now()-interval '23 hours' and o.attempt_count<=5
      and c.enabled and c.release_after is not null and o.created_at>=c.release_after
      and o.event_type=any(c.released_event_types)
      and m.permanent_listing and m.directory_status<>'removed' and not m.do_not_contact
      and not public.outreach_is_suppressed(o.recipient_email,o.merchant_id)
      and not exists(select 1 from public.outreach_suppression s where s.merchant_id=o.merchant_id)
      and not exists(select 1 from public.directory_exclusions e where e.merchant_id=o.merchant_id)
  )
$$;
revoke all on function public.claim_merchant_notifications(integer),public.merchant_notification_send_allowed(uuid) from public,anon,authenticated;
grant execute on function public.claim_merchant_notifications(integer),public.merchant_notification_send_allowed(uuid) to service_role;

