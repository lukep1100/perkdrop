-- Consolidate verified address variants within these two physical Adelaide venues.
-- Keep former venue paths and offer-specific meeting-point text.
insert into public.discovery_venues(id,name,address,state,latitude,longitude) values
 ('venue:adelaide-botanic-garden','Adelaide Botanic Garden','North Terrace, Adelaide SA','SA',-34.918,138.6118),
 ('venue:sa-museum-north-terrace','South Australian Museum','North Terrace, Adelaide SA','SA',-34.9207,138.6034);
update public.catalogue_items set metadata=coalesce(metadata,'{}')||jsonb_build_object('legacy_place_keys',coalesce(metadata->'legacy_place_keys','[]')||jsonb_build_array(venue_id)),
 venue_id=case merchant when 'Adelaide Botanic Garden' then 'venue:adelaide-botanic-garden' else 'venue:sa-museum-north-terrace' end
where state='SA' and ((merchant='Adelaide Botanic Garden' and source like 'https://www.botanicgardens.sa.gov.au/%') or (merchant='South Australian Museum' and (source like 'https://www.samuseum.sa.gov.au/%' or source like 'https://whatson.samuseum.sa.gov.au/%')));
-- A CC0 record is also licence evidence; distinguish a venue image from event artwork.
update public.catalogue_items set media_rights_note=concat('Venue photograph. ',metadata->'image_provenance'->>'caption',' · ',metadata->'image_provenance'->>'license',' · ',metadata->'image_provenance'->>'source'),metadata=metadata||'{"image_kind":"venue"}'::jsonb
where media_status='licensed' and jsonb_typeof(metadata->'image_provenance')='object' and metadata->'image_provenance'->>'license' like 'CC%'
and image_url not like '%venue-unavailable%' and media_rights_note ilike '%placeholder%';
