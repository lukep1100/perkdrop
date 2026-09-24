-- First rights-cleared public-source media batch.
-- Each image is an exact, current depiction of the named venue and is licensed
-- CC BY-SA 4.0. Attribution and licence links are retained in the public card.

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Main_entrance_of_the_Art_Gallery_of_South_Australia_(DSCF3673).jpg?width=1200',
  image_alt = 'Art Gallery of South Australia entrance',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'Yu Chu Chin (Pangalau), Art Gallery of South Australia entrance, 27 Mar 2026.',
      'source', 'https://commons.wikimedia.org/wiki/File:Main_entrance_of_the_Art_Gallery_of_South_Australia_(DSCF3673).jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'Art Gallery of South Australia'
  and (image_url is null or image_url like '%venue-unavailable.svg%');

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Brisbane_Museum_at_the_Brisbane_City_Hall.jpg?width=1200',
  image_alt = 'Museum of Brisbane at Brisbane City Hall',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'Kgbo, Museum of Brisbane at Brisbane City Hall, 5 Sep 2017.',
      'source', 'https://commons.wikimedia.org/wiki/File:Brisbane_Museum_at_the_Brisbane_City_Hall.jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'Museum of Brisbane'
  and (image_url is null or image_url like '%venue-unavailable.svg%');

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Melbourne_National_Gallery_of_Victoria_Main_facade_seen_in_front.jpg?width=1200',
  image_alt = 'National Gallery of Victoria facade in Melbourne',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'Ymblanter, National Gallery of Victoria facade, 8 Apr 2024.',
      'source', 'https://commons.wikimedia.org/wiki/File:Melbourne_National_Gallery_of_Victoria_Main_facade_seen_in_front.jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'National Gallery of Victoria'
  and (image_url is null or image_url like '%venue-unavailable.svg%');

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/National_Gallery_of_Australia_main_entrance.jpg?width=1200',
  image_alt = 'National Gallery of Australia main entrance',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'John Edwards, National Gallery of Australia main entrance, 8 Mar 2016.',
      'source', 'https://commons.wikimedia.org/wiki/File:National_Gallery_of_Australia_main_entrance.jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'National Gallery of Australia'
  and (image_url is null or image_url like '%venue-unavailable.svg%');
