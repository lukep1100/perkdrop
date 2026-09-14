-- A public hero is a representation of a real venue. Keep candidate and
-- unverified image URLs out of the directory even when a direct service-role
-- write bypasses the merchant UI.
alter table public.merchants
  add constraint merchants_hero_image_rights_check
  check (
    hero_image_url is null
    or image_rights_status in ('merchant_authorised', 'licensed')
  ) not valid;

alter table public.merchants
  validate constraint merchants_hero_image_rights_check;
