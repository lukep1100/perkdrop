-- Restore automatic publishing only for freshly verified v3 structured events.
-- Preserve historical records; expired listings disappear from public discovery.
begin;
create or replace function perkdrop_private.normalize_event_candidate()
returns trigger language plpgsql set search_path=public,perkdrop_private,pg_temp as $$
declare market text;
begin
  if new.candidate_type<>'event' then return new; end if;
  market:=lower(replace(coalesce(new.market_id,new.metadata->>'city',''),' ','-'));
  if not exists(select 1 from public.markets where id=market) then
    select lower(replace(primary_city,' ','-')) into market from public.merchants where id=new.merchant_id;
  end if;
  new.market_id:=case when exists(select 1 from public.markets where id=market) then market else null end;
  -- Do not merge all occurrences with the same title into a single date range.
  -- The publisher uses canonical URL + title + occurrence start for idempotency.
  return new;
end $$;

create or replace function public.perkdrop_public_event_class_gate()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  if new.candidate_type='event' and new.status='new' and not (
    coalesce(new.metadata->>'detected_by','')='perkdrop-event-watch-v3'
    and coalesce(new.metadata->>'auto_publish_eligible','false')='true'
    and ((coalesce(new.metadata->>'price_verified','false')='true' and coalesce(new.metadata->>'price_kind','') in ('free','paid','mixed','zero_option'))
      or (new.metadata->>'price_kind'='unknown' and new.price_text='Check organiser for pricing'))
    and coalesce(new.metadata->>'verification_issue','')=''
  ) then
    new.status:='needs_review';
  end if;
  return new;
end $$;

create or replace function perkdrop_private.try_auto_publish_event_candidate()
returns trigger language plpgsql set search_path=public,perkdrop_private,pg_temp as $$
declare
  src public.merchant_sources%rowtype; merch public.merchants%rowtype; cfg public.event_watch_config%rowtype;
  m jsonb:=coalesce(new.metadata,'{}'::jsonb); lat double precision; lng double precision;
  zone text; canonical text; drop_id text; slug text; local_end date; existing_id text;
begin
  if new.candidate_type<>'event' or new.status not in ('new','approved') or new.published_drop_id is not null then return new; end if;
  select * into cfg from public.event_watch_config where singleton=true;
  if not found or not cfg.enabled or coalesce(new.confidence,0)<cfg.auto_publish_confidence then return new; end if;
  if m->>'detected_by'<>'perkdrop-event-watch-v3' or coalesce(m->>'auto_publish_eligible','false')<>'true'
     or not ((coalesce(m->>'price_verified','false')='true' and coalesce(m->>'price_kind','') in ('free','paid','mixed','zero_option'))
       or (m->>'price_kind'='unknown' and new.price_text='Check organiser for pricing'))
     or coalesce(m->>'verification_issue','')<>'' then return new; end if;
  if new.starts_at is null or new.ends_at is null or new.ends_at<=now() or new.ends_at<=new.starts_at
     or new.starts_at>now()+make_interval(days=>cfg.max_future_days) then return new; end if;
  if coalesce(m->>'source_checked_at','')='' or (m->>'source_checked_at')::timestamptz<now()-interval '24 hours' then return new; end if;
  select * into src from public.merchant_sources where id=new.source_id;
  select * into merch from public.merchants where id=new.merchant_id;
  if merch.id is null or src.id is null or not src.authoritative or not src.monitoring_enabled or src.last_http_status is distinct from 200 then return new; end if;
  if merch.permanent_listing is not true or merch.directory_status='removed' then return new; end if;
  if lower(coalesce(m->>'event_status',''))~'cancel|postpon|reschedul' or lower(coalesce(m->>'availability',''))~'soldout|discontinued' then return new; end if;
  if coalesce(m->>'latitude','')!~'^-?[0-9]+([.][0-9]+)?$' or coalesce(m->>'longitude','')!~'^-?[0-9]+([.][0-9]+)?$' then return new; end if;
  lat:=(m->>'latitude')::double precision;lng:=(m->>'longitude')::double precision;
  if lat not between -44 and -10 or lng not between 112 and 154 or coalesce(m->>'location','')='' or coalesce(m->>'city','')='' then return new; end if;
  zone:=case m->>'state' when 'SA' then 'Australia/Adelaide' when 'NT' then 'Australia/Darwin' when 'WA' then 'Australia/Perth' when 'QLD' then 'Australia/Brisbane' when 'VIC' then 'Australia/Melbourne' when 'TAS' then 'Australia/Hobart' when 'NSW' then 'Australia/Sydney' when 'ACT' then 'Australia/Sydney' end;
  if zone is null then return new; end if;
  canonical:=coalesce(nullif(m->>'event_url',''),new.source_url);
  if canonical!~'^https://' or regexp_replace(split_part(split_part(canonical,'://',2),'/',1),'^www[.]','')<>regexp_replace(split_part(split_part(src.source_url,'://',2),'/',1),'^www[.]','') then return new; end if;
  local_end:=((new.ends_at-interval '1 millisecond') at time zone zone)::date;
  select ci.id into existing_id from public.catalogue_items ci where ci.active
    and rtrim(lower(ci.source),'/')=rtrim(lower(canonical),'/')
    and lower(btrim(ci.title))=lower(btrim(new.title))
    and (ci.starts_at=new.starts_at or (ci.starts_at is null and ci.end_date=local_end)) limit 1;
  if existing_id is not null then
    update public.deal_candidates set status='duplicate',published_drop_id=existing_id,reviewed_at=now(),updated_at=now() where id=new.id;
    return new;
  end if;
  drop_id:='AUTO-EVT3-'||upper(substr(md5(canonical||'|'||lower(new.title)||'|'||extract(epoch from new.starts_at)::text),1,20));
  slug:='event-'||lower(substr(md5(canonical||'|'||lower(new.title)||'|'||extract(epoch from new.starts_at)::text),1,20));
  insert into public.catalogue_items(id,merchant_id,merchant,title,description,category,kind,city,state,location,timing,end_date,starts_at,ends_at,timezone,price,conditions,booking,source,verified,hot,featured,slug,detail_url,city_label,active,metadata,latitude,longitude,image_url,image_alt,venue_type,offer_origin,exclusive,lifecycle_status,last_verified_at,media_status,quality_grade)
  values(drop_id,new.merchant_id,merch.name,new.title,coalesce(new.summary,''),'Events','event',m->>'city',m->>'state',m->>'location',m->>'timing',local_end,new.starts_at,new.ends_at,zone,new.price_text,coalesce(new.conditions_text,''),coalesce(m->>'booking_required','false')='true',canonical,to_char(now() at time zone zone,'DD Mon'),new.starts_at<=now()+interval '7 days',false,slug,'/deals/'||slug,initcap(replace(m->>'city','-',' ')),true,
    m||jsonb_build_object('auto_published',true,'candidate_id',new.id,'source_id',new.source_id,'original_go_url',coalesce(nullif(m->>'booking_url',''),canonical),'published_at',now()),lat,lng,'https://perkdrop.au/images/venue-unavailable.svg','PerkDrop neutral event image','event venue','public_source',false,'active',now(),'placeholder','A')
  on conflict(id) do update set title=excluded.title,description=excluded.description,timing=excluded.timing,end_date=excluded.end_date,starts_at=excluded.starts_at,ends_at=excluded.ends_at,timezone=excluded.timezone,price=excluded.price,last_verified_at=now(),updated_at=now()
  where catalogue_items.metadata->>'auto_published'='true' and coalesce(catalogue_items.metadata->>'accuracy_hold','false')<>'true';
  if not exists(select 1 from public.catalogue_items where id=drop_id and active=true) then return new; end if;
  update public.deal_candidates set status='published',published_drop_id=drop_id,reviewed_at=now(),updated_at=now(),metadata=metadata||jsonb_build_object('auto_publish_result','published','auto_published_at',now()) where id=new.id;
  return new;
exception when others then
  update public.deal_candidates set status='needs_review',updated_at=now(),metadata=metadata||jsonb_build_object('auto_publish_result','blocked','auto_publish_error',sqlerrm,'auto_publish_checked_at',now()) where id=new.id;
  return new;
end $$;
alter table public.deal_candidates enable trigger deal_candidates_auto_publish_event;

-- Timestamp end takes precedence; date-only rows remain visible through their venue-local day.
create or replace function public.expire_catalogue_items()
returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  update public.catalogue_items ci set active=false,lifecycle_status='expired',expired_at=coalesce(ci.expired_at,now()),updated_at=now()
  where ci.active=true and (
    (ci.ends_at is not null and ci.ends_at<=now()) or
    (ci.ends_at is null and ci.end_date is not null and ci.end_date < (now() at time zone
      case ci.state when 'SA' then 'Australia/Adelaide' when 'NT' then 'Australia/Darwin' when 'WA' then 'Australia/Perth' when 'QLD' then 'Australia/Brisbane' when 'VIC' then 'Australia/Melbourne' when 'TAS' then 'Australia/Hobart' else 'Australia/Sydney' end)::date)
  );
  get diagnostics affected=row_count;return affected;
end $$;
revoke all on function public.expire_catalogue_items() from public,anon,authenticated;
grant execute on function public.expire_catalogue_items() to service_role;
select cron.schedule('perkdrop-expire-venue-local-every-minute','* * * * *','select public.expire_catalogue_items();');
select cron.alter_job(jobid,schedule:='*/5 * * * *') from cron.job where jobname='perkdrop-event-watch-every-5-min';
select cron.alter_job(jobid,schedule:='23 * * * *') from cron.job where jobname='perkdrop-event-watch-profiled-15m';
select cron.alter_job(jobid,command:=replace(command,'timeout_milliseconds := 60000','timeout_milliseconds := 120000')) from cron.job where jobname='perkdrop-event-watch-every-5-min';
update public.event_watch_config set batch_size=60,interval_minutes=30,updated_at=now() where singleton=true;
commit;
