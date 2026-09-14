-- Keep sanitized catalogue dependency failures available after hosted log
-- retention expires. The public API only writes labels and correlation data;
-- raw database error text and request query strings are never persisted.
create table if not exists public.catalogue_api_failures (
  id bigint generated always as identity primary key,
  request_id text not null check (char_length(request_id) between 1 and 180),
  endpoint text not null check (endpoint in ('health', 'catalogue', 'slug')),
  failure_status text not null check (failure_status ~ '^[a-z0-9_-]{1,64}$'),
  failed_queries text[] not null default '{}',
  duration_ms integer not null check (duration_ms >= 0 and duration_ms <= 120000),
  occurred_at timestamptz not null default now()
);

alter table public.catalogue_api_failures enable row level security;
revoke all on public.catalogue_api_failures from anon, authenticated;
grant select, insert on public.catalogue_api_failures to service_role;
grant usage, select on sequence public.catalogue_api_failures_id_seq to service_role;
create index if not exists catalogue_api_failures_occurred_idx
  on public.catalogue_api_failures (occurred_at desc);
