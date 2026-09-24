-- Second rights-cleared public-source media batch.
-- Every image is a verified depiction of the named venue and its licence and
-- attribution are retained in the public catalogue card.

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Exterior_of_Sydney_Opera_House.jpg?width=1200',
  image_alt = 'Exterior of Sydney Opera House',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'BennyG3255, Exterior of Sydney Opera House, 9 Dec 2016.',
      'source', 'https://commons.wikimedia.org/wiki/File:Exterior_of_Sydney_Opera_House.jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'Sydney Opera House'
  and (image_url is null or image_url like '%venue-unavailable.svg%');

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/Federation_Square.jpg?width=1200',
  image_alt = 'Federation Square in Melbourne',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'Dprzvhar, Federation Square, 18 Feb 2026.',
      'source', 'https://commons.wikimedia.org/wiki/File:Federation_Square.jpg',
      'license', 'CC0 1.0 Universal',
      'licenseUrl', 'https://creativecommons.org/publicdomain/zero/1.0/'
    )
  )
where merchant = 'Fed Square'
  and (image_url is null or image_url like '%venue-unavailable.svg%');

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/MAGNT_Darwin%2C_2023_%2801%29.jpg?width=1200',
  image_alt = 'Museum and Art Gallery of the Northern Territory in Darwin',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'Bahnfrend, external view of MAGNT Darwin, 27 Aug 2023.',
      'source', 'https://commons.wikimedia.org/wiki/File:MAGNT_Darwin,_2023_(01).jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'Museum and Art Gallery of the Northern Territory'
  and (image_url is null or image_url like '%venue-unavailable.svg%');

update public.catalogue_items
set
  image_url = 'https://commons.wikimedia.org/wiki/Special:Redirect/file/The_Art_Gallery_of_Western_Australia%2C_Perth%2C_2023%2C_04.jpg?width=1200',
  image_alt = 'Art Gallery of Western Australia in Perth',
  media_status = 'licensed',
  metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object(
    'image_provenance', jsonb_build_object(
      'caption', 'Kgbo, The Art Gallery of Western Australia, Perth, 2023.',
      'source', 'https://commons.wikimedia.org/wiki/File:The_Art_Gallery_of_Western_Australia,_Perth,_2023,_04.jpg',
      'license', 'CC BY-SA 4.0',
      'licenseUrl', 'https://creativecommons.org/licenses/by-sa/4.0/'
    )
  )
where merchant = 'Art Gallery of Western Australia'
  and (image_url is null or image_url like '%venue-unavailable.svg%');
