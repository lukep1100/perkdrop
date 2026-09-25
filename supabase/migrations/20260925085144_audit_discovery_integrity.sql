-- These columns already exist in production; include them for portable local fixtures.
alter table public.catalogue_items add column if not exists starts_at timestamptz;
alter table public.catalogue_items add column if not exists timezone text;
alter table public.catalogue_items add column if not exists schedule_verified_at timestamptz;
alter table public.catalogue_items add column if not exists media_rights_note text;
-- Stable branch IDs are assigned once and survive corrected coordinates.
create table public.discovery_venues (
 id text primary key, name text not null, address text not null default '', state text not null,
 latitude double precision, longitude double precision,
 created_at timestamptz not null default now(),
 check ((latitude is null and longitude is null) or (latitude between -44 and -10 and longitude between 112 and 154))
);
alter table public.discovery_venues enable row level security;
revoke all on public.discovery_venues from public,anon,authenticated;
grant select,insert,update,delete on public.discovery_venues to service_role;
alter table public.catalogue_items add column venue_id text references public.discovery_venues(id);
create index catalogue_items_venue_idx on public.catalogue_items(venue_id);
create function public.assign_discovery_venue() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare k text; nm text; addr text;
begin
 if new.venue_id is not null then return new; end if;
 nm:=trim(regexp_replace(lower(coalesce(new.merchant,'')),'[^a-z0-9]+',' ','g'));
 addr:=trim(regexp_replace(lower(coalesce(new.location,'')),'[^a-z0-9]+',' ','g'));
 k:='venue:'||md5(nm||'|'||coalesce(new.state,new.city,'')||'|'||addr);
 insert into public.discovery_venues(id,name,address,state,latitude,longitude)
 values(k,coalesce(new.merchant,''),coalesce(new.location,''),coalesce(new.state,''),
 case when new.latitude between -44 and -10 and new.longitude between 112 and 154 then new.latitude end,
 case when new.latitude between -44 and -10 and new.longitude between 112 and 154 then new.longitude end)
 on conflict(id) do nothing;
 new.venue_id:=k; return new;
end $$;
revoke all on function public.assign_discovery_venue() from public,anon,authenticated;
create trigger catalogue_assign_venue before insert or update of venue_id on public.catalogue_items for each row execute function public.assign_discovery_venue();
update public.catalogue_items set venue_id=null where venue_id is null;
-- One verified physical gallery, despite older coordinate/address variants.
insert into public.discovery_venues(id,name,address,state,latitude,longitude)
values('venue:agsa-north-terrace','Art Gallery of South Australia','North Terrace, Adelaide SA 5000','SA',-34.921,138.6047);
update public.catalogue_items set venue_id='venue:agsa-north-terrace'
where merchant='Art Gallery of South Australia' and state='SA' and source like 'https://www.agsa.sa.gov.au/%';

-- Edits to facts require renewed schedule evidence, rather than inheriting an old check.
create function public.invalidate_changed_schedule() returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if (new.starts_at,new.ends_at,new.timezone,new.source,new.price) is distinct from (old.starts_at,old.ends_at,old.timezone,old.source,old.price)
 and new.schedule_verified_at is not distinct from old.schedule_verified_at then
   new.schedule_verified_at:=null;
   new.availability:=coalesce(new.availability,'{}'::jsonb)||'{"reviewState":"unknown"}'::jsonb;
 end if;
 return new;
end $$;
create trigger catalogue_schedule_changed before update on public.catalogue_items for each row execute function public.invalidate_changed_schedule();

-- First-party evidence checked 25 September 2026. Adelaide is UTC+10:30 on 16 October.
update public.catalogue_items set starts_at='2026-10-16T09:30:00Z',ends_at='2026-10-16T10:30:00Z',timezone='Australia/Adelaide',end_date='2026-10-16',
 timing='Friday 16 October · 8–9pm',schedule_verified_at=now(),last_verified_at=now(),
 availability=jsonb_build_object('reviewState','checked','sourceUrl',source,'checkedAt',now(),'label','Friday 16 October · 8–9pm','validFrom','2026-10-16','validUntil','2026-10-16'),
 metadata=coalesce(metadata,'{}')||jsonb_build_object('pricing',jsonb_build_object('currency','AUD','verified',true,'basis','person','amount',0,'feesIncluded',true),'suitability',jsonb_build_object('verified',true,'allAges',true,'setting','outdoor','wheelchair',true,'warning','Strong language and adult themes','sourceUrl',source))
where id='PD-NAT-SA-0919-01' and source='https://www.adelaidefestivalcentre.com.au/whats-on/regurgitator';
update public.catalogue_items set schedule_verified_at=now(),
 availability=availability||jsonb_build_object('checkedAt',now(),'reviewState','checked','windows',jsonb_build_array(jsonb_build_object('days',array[1,2,3,4,5,6,7],'start','10:00','end','17:00'))),
 metadata=coalesce(metadata,'{}')||jsonb_build_object('suitability',jsonb_build_object('verified',true,'setting','indoor','sourceUrl',source))
where id='PD-2026-SA-0803' and source='https://www.agsa.sa.gov.au/whats-on/event-calendar/nature-festival-seed/self-guided-tour-seeds-of-change/';
update public.catalogue_items set schedule_verified_at=now(),last_verified_at=now(),
 availability=jsonb_build_object('reviewState','checked','checkedAt',now(),'sourceUrl',source,'validFrom','2026-09-28','validUntil','2026-10-11','label','28 Sep–11 Oct · daily 10am–5pm','windows',jsonb_build_array(jsonb_build_object('days',array[1,2,3,4,5,6,7],'start','10:00','end','17:00')),'notes','Free trail and origami only. Discovery Centre talks are Mon/Wed/Fri 1–1:15pm, excluding Labour Day. Ticketed exhibition and workshops cost extra.'),
 metadata=coalesce(metadata,'{}')||jsonb_build_object('suitability',jsonb_build_object('verified',true,'allAges',true,'setting','indoor','sourceUrl',source))
where id='PD-2026-SA-0901' and source='https://whatson.samuseum.sa.gov.au/events/october-school-holidays-2026';
-- Align stale placeholder notes only when the current asset already has recorded licence evidence.
update public.catalogue_items set media_rights_note=concat('Venue photograph. ',metadata->'image_provenance'->>'caption',' · ',metadata->'image_provenance'->>'license',' · ',metadata->'image_provenance'->>'source'),
 metadata=metadata||'{"image_kind":"venue"}'::jsonb
where media_status='licensed' and jsonb_typeof(metadata->'image_provenance')='object'
and metadata->'image_provenance'->>'license' like 'CC %'
and image_url not like '%venue-unavailable%' and media_rights_note ilike '%placeholder%';

alter table public.marketplace_plans add column group_details jsonb not null default '{"adults":1,"ages":[]}'::jsonb check(jsonb_typeof(group_details)='object');

do $$ declare definition text; begin
 select pg_get_constraintdef(oid) into definition from pg_constraint where conrelid='public.engagement_events'::regclass and conname='engagement_events_event_type_check';
 if definition is not null then
   alter table public.engagement_events drop constraint engagement_events_event_type_check;
   execute 'alter table public.engagement_events add constraint engagement_events_event_type_check check ((' || substring(definition from 8 for length(definition)-8) || ') or event_type in (''plan_created'',''plan_shared'',''calendar_export'',''account_linked''))';
 end if;
end $$;
