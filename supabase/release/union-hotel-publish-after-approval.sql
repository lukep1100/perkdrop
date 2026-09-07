-- RUN ONLY AFTER Luke approves the final preview and a merchant-authorised image.
-- This is intentionally not a migration: the Union offer remains unpublished until release.
-- Before running in the same transaction, set both values to reviewed HTTPS URLs:
--   set local perkdrop.union_image_url = 'https://...';
--   set local perkdrop.union_image_source_url = 'https://...';

begin;

do $$
declare
  v_drop_id constant text := 'UNION-HOTEL-LUNCH-20-OFF';
  v_merchant_id constant uuid := '33616e77-2421-47a9-b420-ffa217124c3b';
  v_offer_id constant uuid := '5f1a5ca3-30ba-4747-869a-0a60edb596c7';
  v_image_url text := nullif(current_setting('perkdrop.union_image_url', true), '');
  v_image_source_url text := nullif(current_setting('perkdrop.union_image_source_url', true), '');
  v_action_type text;
  v_session_count integer;
begin
  if v_image_url is null or v_image_url !~ '^https://' then
    raise exception 'Union publish blocked: merchant-authorised HTTPS image is required';
  end if;
  if v_image_source_url is null or v_image_source_url !~ '^https://' then
    raise exception 'Union publish blocked: image rights/source URL is required';
  end if;

  select action_type into v_action_type
  from public.merchant_offers
  where id = v_offer_id and merchant_id = v_merchant_id and status = 'active'
  for update;
  if v_action_type is distinct from 'booking_claim' then
    raise exception 'Union publish blocked: approved booking_claim offer was not found';
  end if;

  select count(*) into v_session_count
  from public.offer_sessions
  where merchant_offer_id = v_offer_id
    and status = 'active'
    and service_date >= current_date
    and capacity_total = 20;
  if v_session_count = 0 then
    raise exception 'Union publish blocked: no eligible 20-diner sessions exist';
  end if;

  insert into public.catalogue_items (
    id, merchant_id, merchant, title, description, category, kind, city, state,
    location, timing, end_date, price, conditions, booking, source, verified,
    hot, featured, slug, detail_url, city_label, active, metadata, latitude,
    longitude, image_url, image_alt, cuisine, discount_percent, venue_type,
    offer_origin, exclusive, lifecycle_status, last_verified_at
  ) values (
    v_drop_id, v_merchant_id, 'Union Hotel', '20% OFF FOOD',
    'Save 20% on eligible food at Union Hotel during Monday–Thursday lunch when purchasing a drink.',
    'Food', 'food', 'adelaide', 'SA', '70 Waymouth St, Adelaide SA 5000',
    'MON–THU • 11:30AM–2:30PM', null, '20% OFF',
    'Purchase of a drink required. Drinks are not discounted. Existing Union Hotel specials/promotions are excluded. Real table booking required. Party size 1–6. Limited to 20 PerkDrop diners per eligible lunch.',
    true, 'https://www.theunionhotel.com.au/eat', 'Merchant-approved pilot terms',
    false, false, 'union-hotel-20-off-lunch', '/deals/union-hotel-20-off-lunch',
    'Adelaide', false,
    jsonb_build_object('image_source_url', v_image_source_url, 'pilot_key', 'union_lunch_20pct_2026', 'capacity_source', 'offer_sessions'),
    -34.9258117, 138.5970574, v_image_url, 'Food and dining at Union Hotel, Adelaide',
    'Modern Australian pub food', 20, 'hotel pub', 'perkdrop_exclusive', true,
    'active', now()
  )
  on conflict (id) do update set
    merchant_id = excluded.merchant_id,
    merchant = excluded.merchant,
    title = excluded.title,
    description = excluded.description,
    category = excluded.category,
    kind = excluded.kind,
    city = excluded.city,
    state = excluded.state,
    location = excluded.location,
    timing = excluded.timing,
    price = excluded.price,
    conditions = excluded.conditions,
    booking = excluded.booking,
    source = excluded.source,
    verified = excluded.verified,
    slug = excluded.slug,
    detail_url = excluded.detail_url,
    city_label = excluded.city_label,
    metadata = excluded.metadata,
    latitude = excluded.latitude,
    longitude = excluded.longitude,
    image_url = excluded.image_url,
    image_alt = excluded.image_alt,
    cuisine = excluded.cuisine,
    discount_percent = excluded.discount_percent,
    venue_type = excluded.venue_type,
    offer_origin = excluded.offer_origin,
    exclusive = excluded.exclusive,
    lifecycle_status = excluded.lifecycle_status,
    last_verified_at = excluded.last_verified_at,
    active = false;

  -- Recurring capacity must always come from the next applicable offer_session.
  update public.merchant_offers
  set published_drop_id = v_drop_id,
      category = 'Food', cuisine = 'Modern Australian pub food', venue_type = 'Pub',
      action_type = 'booking_claim', capacity_total = null, capacity_remaining = null
  where id = v_offer_id and merchant_id = v_merchant_id;

  -- The existing database publish guard validates every required catalogue field here.
  update public.catalogue_items set active = true where id = v_drop_id;
end $$;

commit;
