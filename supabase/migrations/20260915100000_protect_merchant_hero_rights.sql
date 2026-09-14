-- A public hero is a representation of a real venue. Keep candidate and
-- unverified image URLs out of the directory even when a direct service-role
-- write bypasses the merchant UI. The guarded add makes this safe to reconcile
-- after the production constraint was applied through the connected dashboard.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.merchants'::regclass
      and conname = 'merchants_hero_image_rights_check'
  ) then
    alter table public.merchants
      add constraint merchants_hero_image_rights_check
      check (
        hero_image_url is null
        or image_rights_status in ('merchant_authorised', 'licensed')
      ) not valid;
  end if;
end $$;

alter table public.merchants
  validate constraint merchants_hero_image_rights_check;
