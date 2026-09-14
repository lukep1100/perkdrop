-- Isolated v2 jobs preserve the pre-existing campaigns/posts and their history.
-- Version matches the authenticated production migration applied on 2026-09-14.
create table public.social_publishing_jobs (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 160),
  caption text not null check (length(caption) between 1 and 2200),
  channels jsonb not null check (jsonb_typeof(channels) = 'array' and jsonb_array_length(channels) between 1 and 2),
  assets jsonb not null check (jsonb_typeof(assets) = 'array' and jsonb_array_length(assets) = 5),
  status text not null default 'uploading' check (status in
    ('uploading','verifying','verification_failed','ready','drafting','draft_failed','reconciliation_required','drafted')),
  preview_hash text,
  verification jsonb not null default '[]',
  buffer_posts jsonb not null default '{}',
  error jsonb,
  approved_by uuid references auth.users(id),
  approved_at timestamptz,
  verified_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.social_publishing_events (
  id bigint generated always as identity primary key,
  job_id uuid not null references public.social_publishing_jobs(id),
  status text not null,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index social_publishing_events_job_time on public.social_publishing_events(job_id, created_at);
create index social_publishing_jobs_created on public.social_publishing_jobs(created_at desc);
create index social_publishing_jobs_created_by on public.social_publishing_jobs(created_by);
create index social_publishing_jobs_approved_by on public.social_publishing_jobs(approved_by);
alter table public.social_publishing_jobs enable row level security;
alter table public.social_publishing_events enable row level security;
revoke all on public.social_publishing_jobs, public.social_publishing_events from public, anon, authenticated;
grant select,insert,update on public.social_publishing_jobs to service_role;
grant select,insert on public.social_publishing_events to service_role;
grant usage,select on sequence public.social_publishing_events_id_seq to service_role;

create function public.social_publishing_audit()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    if new.caption is distinct from old.caption or new.assets is distinct from old.assets or new.channels is distinct from old.channels then
      raise exception 'Preview content is immutable; create a new job for changed content';
    end if;
  end if;
  return new;
end;
$$;
create trigger social_publishing_guard before update on public.social_publishing_jobs
for each row execute function public.social_publishing_audit();
create function public.social_publishing_event()
returns trigger language plpgsql set search_path = '' as $$
begin
  insert into public.social_publishing_events(job_id,status,detail)
    values(new.id,new.status,jsonb_build_object('error',new.error,'preview_hash',new.preview_hash,'buffer_posts',new.buffer_posts));
  return new;
end;
$$;
create trigger social_publishing_history after insert or update on public.social_publishing_jobs
for each row execute function public.social_publishing_event();
revoke all on function public.social_publishing_audit(),public.social_publishing_event() from public,anon,authenticated;
grant execute on function public.social_publishing_audit(),public.social_publishing_event() to service_role;

alter table public.social_publisher_config
  add column if not exists buffer_key_expires_at date,
  add column if not exists key_rotation_warning_at date,
  add column if not exists buffer_checked_at timestamptz,
  add column if not exists buffer_connection_error text;
update public.social_publisher_config set enabled=false,
  buffer_key_expires_at='2026-09-27',key_rotation_warning_at='2026-09-20',updated_at=now()
  where singleton=true;
-- Preserve the encrypted secret and its id; never copy it to Vercel or client config.
revoke all on function public.social_get_buffer_api_key(),public.social_store_buffer_api_key(text) from public,anon,authenticated;
grant execute on function public.social_get_buffer_api_key(),public.social_store_buffer_api_key(text) to service_role;
alter function public.social_get_buffer_api_key() set search_path = '';
alter function public.social_store_buffer_api_key(text) set search_path = '';
revoke all on public.social_publisher_config,public.social_channels from anon,authenticated;
grant select,update on public.social_publisher_config,public.social_channels to service_role;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('social-publishing','social-publishing',true,8000000,array['image/png'])
on conflict(id) do update set public=true,file_size_limit=8000000,allowed_mime_types=array['image/png'];
-- No public upload/update policy: only owner-authorized signed upload grants.
do $$ declare j record; begin
  for j in select jobid from cron.job where jobname='perkdrop-social-publisher-10m'
  loop perform cron.alter_job(j.jobid,active:=false); end loop;
end $$;
