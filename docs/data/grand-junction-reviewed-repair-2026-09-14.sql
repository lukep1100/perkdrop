-- Reviewed one-branch repair, not a bulk import. No email, claim, membership or booking.
begin;
do $$
declare target uuid; previous public.catalogue_items;
begin
  select * into previous from public.catalogue_items where id='PD-2026-0062' for update;
  if previous.updated_at is distinct from '2026-09-14T11:11:52.71088+00:00'::timestamptz
    or previous.merchant_id is not null or previous.location<>'174 Grand Junction Road, Pennington SA 5013'
  then raise exception 'Grand Junction changed since review; inspect again'; end if;
  if exists(select 1 from public.merchants where name ilike '%grand junction%' or primary_location ilike '%174 Grand%'
    or website_url ilike '%grandjunctiontavern%' or regexp_replace(coalesce(public_phone,''),'[^0-9]','','g') in ('0884713096','61884713096'))
  then raise exception 'Potential duplicate branch; inspect before linking'; end if;
  if public.outreach_is_suppressed('info@grandjunctiontavern.com.au',null)
    or exists(select 1 from public.business_requests where business_name ilike '%Grand Junction%' and match_state='confirmed')
    or exists(select 1 from public.directory_exclusions where normalized_name ilike '%grand junction%')
  then raise exception 'Business policy review required'; end if;
  insert into public.merchants(name,slug,description,cuisine,venue_type,primary_city,primary_state,primary_location,
    latitude,longitude,website_url,public_phone,market_id,business_category,location_label,
    source_confidence,source_verified_at,last_source_checked_at,booking_url,metadata)
  values('Grand Junction Tavern','grand-junction-tavern-pennington',
    'Pub and bistro at 174 Grand Junction Road, Pennington. Offers below are sourced from the venue website; this listing has not been claimed by its owner.',
    'Modern Australian / Pub','hotel pub','adelaide','SA','174 Grand Junction Road, Pennington SA 5013',
    -34.8516159,138.5297088,'https://grandjunctiontavern.com.au/','08 8471 3096','adelaide','food_drink','Pennington',
    'official_website',now(),now(),'https://www.sevenrooms.com/reservations/grandjunctiontavern/grand-junction-tavern-widget?venues=grandjunctiontavern',
    jsonb_build_object('identity_source','https://grandjunctiontavern.com.au/contact/',
      'location_verification','Named Google Maps venue at exact official address, website and phone; same place identity as official embedded map. Destination coordinates, not viewport.',
      'google_place_feature_id','0x6ab0c7b2c9d12767:0x23668e26014a9c09',
      'coordinate_checked_at',now(),'image_review_hold','Exact-branch photo reuse permission not received; no image displayed.'))
  returning id into target;
  if not exists(select 1 from public.merchants where id=target and permanent_listing and directory_status='active' and not do_not_contact)
  then raise exception 'Publication policy prevented exact branch insertion'; end if;
  update public.catalogue_items set merchant_id=target,latitude=-34.8516159,longitude=138.5297088,
    metadata=metadata||jsonb_build_object('location_source_url','https://grandjunctiontavern.com.au/contact/',
      'google_place_feature_id','0x6ab0c7b2c9d12767:0x23668e26014a9c09','coordinate_checked_at',now(),
      'location_verification','Named venue destination independently resolved through the official address link. Not an address-search coordinate or map viewport.')
  where id=previous.id;
end $$;
commit;
