-- Consumer release core: private plans and a durable in-app update ledger.
-- External email, SMS and push delivery remain separate opt-in releases.

create table public.marketplace_consumer_updates (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.marketplace_consumers(id) on delete cascade,
  source_outbox_id uuid unique references public.marketplace_outbox(id) on delete set null,
  kind text not null check (kind in ('watch_match','plan','system')),
  title text not null check (length(title) between 1 and 180),
  body text not null default '' check (length(body) <= 600),
  href text check (href is null or href ~ '^/deals/[a-z0-9][a-z0-9_-]{0,159}$'),
  metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.marketplace_consumer_updates enable row level security;
revoke all on public.marketplace_consumer_updates from public, anon, authenticated;
grant select, insert, update, delete on public.marketplace_consumer_updates to service_role;
create index marketplace_consumer_updates_feed_idx on public.marketplace_consumer_updates(consumer_id, created_at desc);
create index marketplace_consumer_updates_unread_idx on public.marketplace_consumer_updates(consumer_id, created_at desc) where read_at is null;

create table public.marketplace_plans (
  id uuid primary key default gen_random_uuid(),
  consumer_id uuid not null references public.marketplace_consumers(id) on delete cascade,
  name text not null check (length(name) between 1 and 100),
  planned_for date,
  note text not null default '' check (length(note) <= 600),
  share_token_hash text unique check (share_token_hash is null or share_token_hash ~ '^[a-f0-9]{64}$'),
  share_created_at timestamptz,
  share_revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.marketplace_plans enable row level security;
revoke all on public.marketplace_plans from public, anon, authenticated;
grant select, insert, update, delete on public.marketplace_plans to service_role;
create index marketplace_plans_consumer_updated_idx on public.marketplace_plans(consumer_id, updated_at desc);

create table public.marketplace_plan_items (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.marketplace_plans(id) on delete cascade,
  catalogue_item_id text not null references public.catalogue_items(id) on delete cascade,
  position integer not null check (position between 0 and 19),
  created_at timestamptz not null default now(),
  unique(plan_id, catalogue_item_id),
  unique(plan_id, position)
);
alter table public.marketplace_plan_items enable row level security;
revoke all on public.marketplace_plan_items from public, anon, authenticated;
grant select, insert, update, delete on public.marketplace_plan_items to service_role;
create index marketplace_plan_items_plan_position_idx on public.marketplace_plan_items(plan_id, position);

-- This is the same public-visibility policy used by the catalogue before it
-- is rendered. Plans and updates must not become a backdoor for items held for
-- accuracy, ended, expired, or removed from the business directory.
-- Older local/exported schemas predate the event timestamp used by the live
-- catalogue; production already has it, and this keeps the predicate portable.
alter table public.catalogue_items add column if not exists ends_at timestamptz;
create or replace function public.marketplace_public_catalogue_items(p_ids text[])
returns table (
  id text,
  merchant text,
  title text,
  slug text,
  location text,
  timing text
)
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select ci.id,ci.merchant,ci.title,ci.slug,ci.location,ci.timing
  from public.catalogue_items ci
  left join public.merchants m on m.id=ci.merchant_id
  where (p_ids is null or ci.id=any(p_ids))
    and ci.active is true
    and not coalesce(ci.metadata @> '{"accuracy_hold":true}'::jsonb,false)
    and (
      ci.merchant_id is null
      or (m.permanent_listing is true and m.directory_status is distinct from 'removed')
    )
    -- Match the catalogue's initial UTC expiry guard and its state-local day
    -- guard, so a plan cannot surface a row the public catalogue has omitted.
    and (ci.end_date is null or ci.end_date >= (now() at time zone 'UTC')::date)
    and (ci.end_date is null or ci.end_date >= (
      now() at time zone (case ci.state
        when 'SA' then 'Australia/Adelaide'
        when 'NT' then 'Australia/Darwin'
        when 'WA' then 'Australia/Perth'
        when 'QLD' then 'Australia/Brisbane'
        when 'NSW' then 'Australia/Sydney'
        when 'ACT' then 'Australia/Sydney'
        when 'VIC' then 'Australia/Melbourne'
        when 'TAS' then 'Australia/Hobart'
        else 'Australia/Sydney'
      end)
    )::date)
    and not (ci.kind='event' and ci.ends_at is not null and ci.ends_at<=now())
$$;
revoke all on function public.marketplace_public_catalogue_items(text[]) from public, anon, authenticated;
grant execute on function public.marketplace_public_catalogue_items(text[]) to service_role;

-- A consumer update is a safe, first-party projection of a Radar match. It
-- intentionally excludes private delivery/recovery payloads in marketplace_outbox.
create or replace function public.marketplace_project_watch_update()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare d record; safe_href text; safe_body text;
begin
  if new.consumer_id is null or new.event <> 'watch_match' then return new; end if;
  select * into d from public.marketplace_public_catalogue_items(
    array[nullif(new.payload->>'drop_id','')]
  ) limit 1;
  if not found then return new; end if;
  safe_href := case
    when d.slug ~ '^[a-z0-9][a-z0-9_-]{0,159}$' then '/deals/' || d.slug
    else null
  end;
  safe_body := coalesce(
    nullif(concat_ws(' — ', nullif(d.merchant,''), nullif(d.title,'')), ''),
    'A new Drop matches one of your saved alerts.'
  );
  insert into public.marketplace_consumer_updates
    (consumer_id,source_outbox_id,kind,title,body,href,metadata)
  values
    (new.consumer_id,new.id,'watch_match','A Drop matched your alert',left(safe_body,600),safe_href,
      jsonb_strip_nulls(jsonb_build_object('watch_id',new.watch_id,'offer_id',new.offer_id,'drop_id',d.id)))
  on conflict(source_outbox_id) do nothing;
  return new;
end $$;
revoke all on function public.marketplace_project_watch_update() from public, anon, authenticated;
grant execute on function public.marketplace_project_watch_update() to service_role;
drop trigger if exists marketplace_project_watch_update on public.marketplace_outbox;
create trigger marketplace_project_watch_update
after insert on public.marketplace_outbox
for each row execute function public.marketplace_project_watch_update();

comment on table public.marketplace_consumer_updates is 'Private in-app consumer update ledger. It must never expose recovery, recipient or external delivery data.';
comment on table public.marketplace_plans is 'Private consumer-owned local plans. Public viewing is only through a revocable opaque token handled by the marketplace Edge Function.';
