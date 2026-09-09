-- PerkDrop owner operations dashboard and duplicate-safe outreach tracking.

alter table public.outreach_contacts
  add column if not exists response text,
  add column if not exists follow_up_date date,
  add column if not exists outcome text;

comment on column public.outreach_contacts.response is
  'Latest response or concise conversation note recorded by the owner.';
comment on column public.outreach_contacts.follow_up_date is
  'Next owner follow-up date, if one is required.';
comment on column public.outreach_contacts.outcome is
  'Final or current commercial outcome for this lead.';

create index if not exists outreach_contacts_follow_up_idx
  on public.outreach_contacts (follow_up_date, status)
  where follow_up_date is not null;

-- Preserve legacy rows while preventing any new case-insensitive email duplicate.
create table if not exists public.outreach_email_registry (
  email_key text primary key,
  primary_contact_id uuid references public.outreach_contacts(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint outreach_email_registry_normalized_check
    check (email_key = lower(btrim(email_key)) and email_key <> '')
);

comment on table public.outreach_email_registry is
  'Internal uniqueness registry used to prevent duplicate merchant outreach by normalized email.';

alter table public.outreach_email_registry enable row level security;

insert into public.outreach_email_registry (email_key, primary_contact_id)
select distinct on (lower(btrim(email))) lower(btrim(email)), id
from public.outreach_contacts
where email is not null and btrim(email) <> ''
order by lower(btrim(email)), created_at, id
on conflict (email_key) do nothing;

create or replace function public.guard_outreach_contact_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_key text;
  previous_key text;
  existing_contact uuid;
  replacement_contact uuid;
begin
  next_key := nullif(lower(btrim(new.email)), '');
  if next_key is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    previous_key := nullif(lower(btrim(old.email)), '');
    if previous_key = next_key then
      new.email := btrim(new.email);
      return new;
    end if;
  end if;

  select primary_contact_id into existing_contact
  from public.outreach_email_registry
  where email_key = next_key
  for update;

  if found and existing_contact is not null and existing_contact is distinct from new.id then
    raise exception using
      errcode = '23505',
      message = 'A merchant outreach contact already uses this email address.';
  end if;

  insert into public.outreach_email_registry (email_key, primary_contact_id)
  values (next_key, new.id)
  on conflict (email_key) do update
    set primary_contact_id = excluded.primary_contact_id;

  if tg_op = 'UPDATE' and previous_key is not null and previous_key <> next_key then
    select id into replacement_contact
    from public.outreach_contacts
    where id <> old.id and lower(btrim(email)) = previous_key
    order by created_at, id
    limit 1;

    if replacement_contact is null then
      delete from public.outreach_email_registry
      where email_key = previous_key and primary_contact_id = old.id;
    else
      update public.outreach_email_registry
      set primary_contact_id = replacement_contact
      where email_key = previous_key and primary_contact_id = old.id;
    end if;
  end if;

  new.email := btrim(new.email);
  return new;
end;
$$;

revoke all on function public.guard_outreach_contact_email() from public, anon, authenticated;

drop trigger if exists outreach_contacts_email_guard on public.outreach_contacts;
create trigger outreach_contacts_email_guard
before insert or update of email on public.outreach_contacts
for each row execute function public.guard_outreach_contact_email();

create or replace function public.release_outreach_contact_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_key text;
  replacement_contact uuid;
begin
  old_key := nullif(lower(btrim(old.email)), '');
  if old_key is null then return old; end if;

  select id into replacement_contact
  from public.outreach_contacts
  where id <> old.id and lower(btrim(email)) = old_key
  order by created_at, id
  limit 1;

  if replacement_contact is null then
      delete from public.outreach_email_registry
      where email_key = old_key and (primary_contact_id = old.id or primary_contact_id is null);
  else
    update public.outreach_email_registry
    set primary_contact_id = replacement_contact
      where email_key = old_key and (primary_contact_id = old.id or primary_contact_id is null);
  end if;
  return old;
end;
$$;

revoke all on function public.release_outreach_contact_email() from public, anon, authenticated;

drop trigger if exists outreach_contacts_email_release on public.outreach_contacts;
create trigger outreach_contacts_email_release
after delete on public.outreach_contacts
for each row execute function public.release_outreach_contact_email();

-- Foreign-key indexes reported by the Supabase production advisor.
create index if not exists outreach_messages_contact_id_idx
  on public.outreach_messages (contact_id);
create index if not exists outreach_suppression_merchant_id_idx
  on public.outreach_suppression (merchant_id);
create index if not exists deal_candidates_market_id_idx
  on public.deal_candidates (market_id);
create index if not exists deal_candidates_published_drop_id_idx
  on public.deal_candidates (published_drop_id);
create index if not exists deal_candidates_source_id_idx
  on public.deal_candidates (source_id);

-- Exact duplicate indexes: retain the canonical/constraint-backed copies.
drop index if exists public.engagement_events_type_created_idx;
drop index if exists public.merchants_slug_unique_idx;
