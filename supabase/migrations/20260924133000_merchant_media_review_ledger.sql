-- Rights-safe merchant media pipeline.
--
-- New merchant uploads remain in a private staging bucket until a PerkDrop
-- owner records a review. Existing approved hero/offer URLs are deliberately
-- left untouched as legacy inventory; this migration only blocks *new* public
-- projections that do not point to an approved ledger asset.

create extension if not exists pgcrypto;

-- Do not reuse the legacy public `merchant-media` bucket for new uploads.
-- The staging bucket is private. The approved bucket is public only after an
-- owner review copies a vetted object into it; no client Storage policy is
-- granted by this migration.
-- Storage RLS policies are additive, so a pre-existing generic policy on
-- storage.objects could otherwise expose a new private bucket. Refuse this
-- migration until such a policy is narrowed in the target project. Policies
-- explicitly scoped to unrelated bucket_id values remain valid.
do $$
declare
  policy_row record;
  policy_expression text;
begin
  for policy_row in
    select policyname, cmd, coalesce(qual,'') as qual, coalesce(with_check,'') as with_check
    from pg_policies
    where schemaname = 'storage'
      and tablename = 'objects'
      and roles && array['anon','authenticated','public']::name[]
  loop
    policy_expression := lower(policy_row.qual || ' ' || policy_row.with_check);
    if policy_expression ~ '(merchant-media-staging|merchant-media-approved)' then
      raise exception 'storage policy % already applies to protected merchant media buckets', policy_row.policyname;
    end if;
    if policy_row.cmd in ('ALL','SELECT','UPDATE','DELETE')
      and (
        policy_row.qual = ''
        or lower(policy_row.qual) !~ 'bucket_id[[:space:]]*(=|in[[:space:]]*\()'
      ) then
      raise exception 'storage policy % has unscoped read/write access; scope it by bucket_id before media migration', policy_row.policyname;
    end if;
    if policy_row.cmd in ('ALL','INSERT','UPDATE')
      and (
        policy_row.with_check = ''
        or lower(policy_row.with_check) !~ 'bucket_id[[:space:]]*(=|in[[:space:]]*\()'
      ) then
      raise exception 'storage policy % has unscoped write access; scope it by bucket_id before media migration', policy_row.policyname;
    end if;
  end loop;
end $$;

-- The preflight above has confirmed this new private bucket cannot inherit a
-- broad client policy. Approved assets are copied into the separate public
-- bucket only after the owner records a rights review.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('merchant-media-staging', 'merchant-media-staging', false, 8388608, array['image/jpeg','image/png','image/webp']),
  ('merchant-media-approved', 'merchant-media-approved', true, 8388608, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.merchant_media_assets (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  offer_id uuid references public.merchant_offers(id) on delete set null,
  asset_kind text not null check (asset_kind in ('hero','logo','offer')),
  staging_bucket text not null default 'merchant-media-staging'
    check (staging_bucket = 'merchant-media-staging'),
  staging_path text not null,
  public_bucket text check (public_bucket is null or public_bucket = 'merchant-media-approved'),
  public_path text,
  public_url text,
  original_filename text not null check (char_length(btrim(original_filename)) between 1 and 255),
  content_type text not null check (content_type in ('image/jpeg','image/png','image/webp')),
  byte_size bigint not null check (byte_size between 1 and 8388608),
  content_sha256 text not null check (content_sha256 ~ '^[a-f0-9]{64}$'),
  rights_basis text not null check (rights_basis in ('merchant_owned','merchant_authorised','licensed','event_organiser_authorised','other_documented')),
  rights_statement text not null check (char_length(btrim(rights_statement)) between 12 and 2000),
  source_url text,
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  submitted_by uuid not null,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  review_evidence text,
  public_projected_at timestamptz,
  public_object_removed_at timestamptz,
  staging_object_removed_at timestamptz,
  staging_cleanup_error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Offer rows always start attached. A reviewed row may be detached only by
  -- the parent offer's FK action, preserving an audit record after deletion.
  constraint merchant_media_assets_offer_kind_check
    check (
      (asset_kind in ('hero','logo') and offer_id is null)
      or (asset_kind = 'offer' and (offer_id is not null or status in ('approved','rejected','revoked')))
    ),
  constraint merchant_media_assets_pending_not_public_check
    check (status <> 'pending' or (public_bucket is null and public_path is null and public_url is null)),
  constraint merchant_media_assets_rejected_not_public_check
    check (status <> 'rejected' or (public_bucket is null and public_path is null and public_url is null)),
  constraint merchant_media_assets_approved_projection_check
    check (status <> 'approved' or (
      public_bucket = 'merchant-media-approved'
      and char_length(coalesce(public_path,'')) > 12
      and char_length(coalesce(public_url,'')) > 24
      and reviewed_by is not null
      and reviewed_at is not null
      and char_length(coalesce(btrim(review_reason),'')) >= 3
      and char_length(coalesce(btrim(review_evidence),'')) >= 3
    ))
);

create index if not exists merchant_media_assets_review_queue_idx
  on public.merchant_media_assets(status, submitted_at asc)
  where status = 'pending';
create index if not exists merchant_media_assets_merchant_idx
  on public.merchant_media_assets(merchant_id, submitted_at desc);
create index if not exists merchant_media_assets_offer_idx
  on public.merchant_media_assets(offer_id)
  where offer_id is not null;
create unique index if not exists merchant_media_assets_staging_object_key
  on public.merchant_media_assets(staging_bucket, staging_path);
create unique index if not exists merchant_media_assets_public_object_key
  on public.merchant_media_assets(public_bucket, public_path)
  where public_path is not null;

alter table public.merchant_media_assets enable row level security;
revoke all on table public.merchant_media_assets from public, anon, authenticated;
grant select, insert, update, delete on table public.merchant_media_assets to service_role;

alter table public.merchants
  add column if not exists hero_media_asset_id uuid,
  add column if not exists logo_media_asset_id uuid;
alter table public.merchant_offers
  add column if not exists media_asset_id uuid;
alter table public.catalogue_items
  add column if not exists media_status text;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.merchants'::regclass and conname = 'merchants_hero_media_asset_fk') then
    alter table public.merchants add constraint merchants_hero_media_asset_fk
      foreign key (hero_media_asset_id) references public.merchant_media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.merchants'::regclass and conname = 'merchants_logo_media_asset_fk') then
    alter table public.merchants add constraint merchants_logo_media_asset_fk
      foreign key (logo_media_asset_id) references public.merchant_media_assets(id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conrelid = 'public.merchant_offers'::regclass and conname = 'merchant_offers_media_asset_fk') then
    alter table public.merchant_offers add constraint merchant_offers_media_asset_fk
      foreign key (media_asset_id) references public.merchant_media_assets(id) on delete set null;
  end if;
end $$;

-- A ledger row is immutable after review except for the approved -> revoked
-- transition and the public-object cleanup timestamp. It also prevents an
-- offer asset from being attached to another merchant's offer.
create or replace function public.guard_merchant_media_asset()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_offer_merchant uuid;
begin
  if new.staging_path not like new.merchant_id::text || '/%' then
    raise exception 'merchant_media_invalid_staging_path';
  end if;

  if new.asset_kind <> 'offer' and new.offer_id is not null then
    raise exception 'merchant_media_offer_link_not_allowed';
  end if;
  if new.asset_kind = 'offer' and new.status = 'approved' and new.offer_id is null
    and not (
      tg_op = 'UPDATE'
      and old.offer_id is not null
      and not exists (select 1 from public.merchant_offers where id = old.offer_id)
    ) then
    raise exception 'merchant_media_offer_target_required';
  end if;
  if new.offer_id is not null then
    select merchant_id into v_offer_merchant from public.merchant_offers where id = new.offer_id;
    if v_offer_merchant is null or v_offer_merchant <> new.merchant_id then
      raise exception 'merchant_media_offer_merchant_mismatch';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if old.merchant_id is distinct from new.merchant_id
      or old.asset_kind is distinct from new.asset_kind
      or old.staging_bucket is distinct from new.staging_bucket
      or old.staging_path is distinct from new.staging_path
      or old.original_filename is distinct from new.original_filename
      or old.content_type is distinct from new.content_type
      or old.byte_size is distinct from new.byte_size
      or old.content_sha256 is distinct from new.content_sha256
      or old.rights_basis is distinct from new.rights_basis
      or old.rights_statement is distinct from new.rights_statement
      or old.source_url is distinct from new.source_url
      or old.submitted_by is distinct from new.submitted_by then
      raise exception 'merchant_media_asset_immutable';
    end if;
    if old.status = 'pending' and new.status not in ('pending','approved','rejected') then
      raise exception 'merchant_media_invalid_status_transition';
    end if;
    if old.status = 'approved' and new.status not in ('approved','revoked') then
      raise exception 'merchant_media_invalid_status_transition';
    end if;
    if old.status in ('rejected','revoked') and new.status is distinct from old.status then
      raise exception 'merchant_media_terminal_status';
    end if;
    if old.offer_id is distinct from new.offer_id then
      -- ON DELETE SET NULL is the only permissible post-insert detach. It is
      -- detected by the absence of the old offer, so service-role callers
      -- cannot reassign an asset (including a pending one) to another offer.
      if not (
        new.offer_id is null
        and old.offer_id is not null
        and not exists (select 1 from public.merchant_offers where id = old.offer_id)
      ) then
        raise exception 'merchant_media_asset_target_immutable';
      end if;
    end if;
  end if;

  if new.status in ('approved','revoked') and (
    new.reviewed_by is null or new.reviewed_at is null or char_length(coalesce(btrim(new.review_reason),'')) < 3
  ) then
    raise exception 'merchant_media_review_reason_required';
  end if;
  if new.status = 'approved' and char_length(coalesce(btrim(new.review_evidence),'')) < 3 then
    raise exception 'merchant_media_review_evidence_required';
  end if;
  if new.status = 'rejected' and (
    new.reviewed_by is null or new.reviewed_at is null or char_length(coalesce(btrim(new.review_reason),'')) < 3
  ) then
    raise exception 'merchant_media_rejection_reason_required';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists merchant_media_assets_guard on public.merchant_media_assets;
create trigger merchant_media_assets_guard
before insert or update on public.merchant_media_assets
for each row execute function public.guard_merchant_media_asset();

-- A URL becomes public only when it is the exact URL recorded on an approved
-- asset for this merchant/offer. Existing legacy fields are accepted only
-- while unchanged, so this is additive and does not erase historical media.
create or replace function public.guard_merchant_public_media_projection()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  a public.merchant_media_assets%rowtype;
  changed_hero boolean := tg_op = 'INSERT';
  changed_logo boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then
    changed_hero := new.hero_image_url is distinct from old.hero_image_url
      or new.hero_media_asset_id is distinct from old.hero_media_asset_id;
    changed_logo := new.logo_url is distinct from old.logo_url
      or new.logo_media_asset_id is distinct from old.logo_media_asset_id;
  end if;

  if changed_hero then
    if new.hero_media_asset_id is null then
      if new.hero_image_url is not null then raise exception 'approved_media_asset_required'; end if;
    else
      select * into a from public.merchant_media_assets where id = new.hero_media_asset_id;
      if not found or a.merchant_id <> new.id or a.asset_kind <> 'hero' or a.status <> 'approved'
        or a.public_url is null or new.hero_image_url is distinct from a.public_url then
        raise exception 'approved_hero_media_asset_required';
      end if;
    end if;
  end if;

  if changed_logo then
    if new.logo_media_asset_id is null then
      if new.logo_url is not null then raise exception 'approved_media_asset_required'; end if;
    else
      select * into a from public.merchant_media_assets where id = new.logo_media_asset_id;
      if not found or a.merchant_id <> new.id or a.asset_kind <> 'logo' or a.status <> 'approved'
        or a.public_url is null or new.logo_url is distinct from a.public_url then
        raise exception 'approved_logo_media_asset_required';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists merchants_media_projection_guard on public.merchants;
create trigger merchants_media_projection_guard
before insert or update of hero_image_url, hero_media_asset_id, logo_url, logo_media_asset_id on public.merchants
for each row execute function public.guard_merchant_public_media_projection();

create or replace function public.guard_offer_public_media_projection()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  a public.merchant_media_assets%rowtype;
  changed_media boolean := tg_op = 'INSERT';
begin
  if tg_op = 'UPDATE' then
    changed_media := new.media_url is distinct from old.media_url
      or new.media_asset_id is distinct from old.media_asset_id;
  end if;
  if not changed_media then return new; end if;

  if new.media_asset_id is null then
    if new.media_url is not null then raise exception 'approved_media_asset_required'; end if;
    return new;
  end if;
  select * into a from public.merchant_media_assets where id = new.media_asset_id;
  if not found or a.merchant_id <> new.merchant_id or a.asset_kind <> 'offer' or a.offer_id <> new.id then
    raise exception 'merchant_media_offer_asset_mismatch';
  end if;
  if a.status = 'pending' then
    if new.media_url is not null then raise exception 'pending_media_asset_not_public'; end if;
    new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object('merchant_media_asset_id',a.id::text,'media_review_status','pending');
    return new;
  end if;
  if a.status <> 'approved' or a.public_url is null then
    raise exception 'approved_offer_media_asset_required';
  end if;
  if new.media_url is not null and new.media_url is distinct from a.public_url then
    raise exception 'approved_offer_media_asset_required';
  end if;
  new.media_url := a.public_url;
  new.metadata := coalesce(new.metadata,'{}'::jsonb) || jsonb_build_object('merchant_media_asset_id',a.id::text,'media_review_status','approved','media_rights_confirmed',true);
  return new;
end;
$$;

drop trigger if exists merchant_offers_media_projection_guard on public.merchant_offers;
create trigger merchant_offers_media_projection_guard
before insert or update of media_url, media_asset_id on public.merchant_offers
for each row execute function public.guard_offer_public_media_projection();

-- Merchant-submitted catalogue cards may only gain a new image through an
-- approved ledger asset. This leaves legacy cards untouched while preventing a
-- future service-role writer from bypassing the offer/hero projection guards.
create or replace function public.guard_catalogue_merchant_media_projection()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  a public.merchant_media_assets%rowtype;
  changed_projection boolean := tg_op = 'INSERT';
  asset_id text;
begin
  if tg_op = 'UPDATE' then
    changed_projection := new.image_url is distinct from old.image_url
      or coalesce(new.metadata->>'merchant_media_asset_id','') is distinct from coalesce(old.metadata->>'merchant_media_asset_id','')
      or new.merchant_id is distinct from old.merchant_id
      or new.offer_origin is distinct from old.offer_origin;
  end if;
  if not changed_projection
    or new.image_url is null
    or (new.offer_origin <> 'merchant_submitted' and nullif(new.metadata->>'merchant_offer_id','') is null) then
    return new;
  end if;

  asset_id := nullif(new.metadata->>'merchant_media_asset_id','');
  if asset_id is null then
    raise exception 'approved_catalogue_media_asset_required';
  end if;
  select * into a from public.merchant_media_assets where id::text = asset_id;
  if not found
    or a.status <> 'approved'
    or a.public_url is null
    or new.image_url is distinct from a.public_url
    or new.merchant_id is distinct from a.merchant_id
    or a.asset_kind not in ('hero','offer') then
    raise exception 'approved_catalogue_media_asset_required';
  end if;
  if a.asset_kind = 'offer'
    and coalesce(new.metadata->>'merchant_offer_id','') is distinct from a.offer_id::text then
    raise exception 'approved_catalogue_offer_media_asset_required';
  end if;
  return new;
end;
$$;

drop trigger if exists catalogue_items_merchant_media_projection_guard on public.catalogue_items;
create trigger catalogue_items_merchant_media_projection_guard
before insert or update of image_url, metadata, merchant_id, offer_origin on public.catalogue_items
for each row execute function public.guard_catalogue_merchant_media_projection();

-- Approval projects the approved object; revocation clears every public
-- projection atomically at the database layer, including already-published
-- catalogue rows. Storage-object deletion is handled by the owner endpoint.
create or replace function public.project_merchant_media_asset()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_rights_status text;
begin
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'approved' then
    v_rights_status := case when new.rights_basis = 'licensed' then 'licensed' else 'merchant_authorised' end;
    if new.asset_kind = 'hero' then
      update public.merchants
      set hero_media_asset_id = new.id,
          hero_image_url = new.public_url,
          image_rights_status = v_rights_status,
          media_rights_confirmed = true,
          metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'hero_media_asset_id',new.id::text,
            'hero_media_review_status','approved',
            'hero_media_approved_at',new.reviewed_at
          )
      where id = new.merchant_id;
    elsif new.asset_kind = 'logo' then
      update public.merchants
      set logo_media_asset_id = new.id,
          logo_url = new.public_url,
          metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
            'logo_media_asset_id',new.id::text,
            'logo_media_review_status','approved'
          )
      where id = new.merchant_id;
    elsif new.asset_kind = 'offer' then
      update public.merchant_offers
      set media_asset_id = new.id,
          media_url = new.public_url
      where id = new.offer_id and merchant_id = new.merchant_id;

      update public.catalogue_items ci
      set image_url = new.public_url,
          media_status = 'approved',
          metadata = (coalesce(ci.metadata,'{}'::jsonb) - 'image_review_hold' - 'revoked_media_asset_id') || jsonb_build_object(
            'merchant_media_asset_id',new.id::text,
            'media_review_status','approved',
            'media_source','merchant_offer'
          ),
          updated_at = now()
      from public.merchant_offers mo
      where mo.id = new.offer_id
        and ci.id = mo.published_drop_id;
    end if;
  end if;

  if tg_op = 'UPDATE' and old.status = 'approved' and new.status = 'revoked' then
    update public.catalogue_items
    set image_url = null,
        media_status = 'permission_required',
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'image_review_hold',true,
          'revoked_media_asset_id',new.id::text,
          'media_review_status','revoked'
        ),
        updated_at = now()
    where metadata->>'merchant_media_asset_id' = new.id::text;

    update public.merchant_offers
    set media_asset_id = null,
        media_url = null,
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'media_review_status','revoked',
          'revoked_media_asset_id',new.id::text,
          'media_rights_confirmed',false
        )
    where media_asset_id = new.id;

    update public.merchants
    set hero_media_asset_id = null,
        hero_image_url = null,
        image_rights_status = 'missing',
        media_rights_confirmed = false,
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'hero_media_review_status','revoked',
          'revoked_hero_media_asset_id',new.id::text
        )
    where hero_media_asset_id = new.id;

    update public.merchants
    set logo_media_asset_id = null,
        logo_url = null,
        metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object(
          'logo_media_review_status','revoked',
          'revoked_logo_media_asset_id',new.id::text
        )
    where logo_media_asset_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists merchant_media_assets_projection on public.merchant_media_assets;
create trigger merchant_media_assets_projection
after update of status on public.merchant_media_assets
for each row execute function public.project_merchant_media_asset();

comment on table public.merchant_media_assets is
  'Private rights-review ledger. New uploads are staged privately and only owner-approved assets are projected to public merchant or offer media fields.';
