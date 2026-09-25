-- Public events and external bookings do not consume PerkDrop claim capacity.
-- Keep merchant authority, provider, schedule and approved media gates in force.
create or replace function public.marketplace_publish(p_actor uuid,p_merchant uuid,p_offer uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare o public.merchant_offers%rowtype; m public.merchants%rowtype; dropid text; slug text; image text; image_asset uuid;
begin
  if not public.marketplace_can_manage(p_actor,p_merchant,true) then raise exception 'merchant_access_denied'; end if;
  select * into m from public.merchants where id=p_merchant;
  if m.listing_status not in ('verified','partner') then raise exception 'verified_merchant_required'; end if;
  select * into o from public.merchant_offers where id=p_offer and merchant_id=p_merchant for update;
  if not found or o.status not in ('draft','pending','paused','rejected') then raise exception 'offer_not_publishable'; end if;
  if o.action_type='booking_claim' or exists(select 1 from public.offer_sessions where merchant_offer_id=o.id) then raise exception 'provider_publication_requires_review'; end if;
  if o.fulfilment_mode not in ('direct_claim','merchant_confirmation','external_booking','information_only') or o.visibility<>'public' then raise exception 'unsupported_publication_mode'; end if;
  if o.fulfilment_mode in ('external_booking','information_only') and (o.booking_url is null or o.booking_url !~ '^https://') then raise exception 'booking_url_required'; end if;
  if (o.fulfilment_mode in ('direct_claim','merchant_confirmation') and (o.capacity_total is null or o.capacity_total<1 or o.capacity_remaining is null or o.capacity_remaining>o.capacity_total)) or o.starts_at is null or o.ends_at is null or o.ends_at<=now() or o.ends_at<=o.starts_at then raise exception 'capacity_and_schedule_required'; end if;
  if length(coalesce(o.conditions,''))<12 or nullif(o.location,'') is null or nullif(o.city,'') is null then raise exception 'terms_and_location_required'; end if;
  if o.normal_price is not null and o.deal_price is not null and o.normal_price<o.deal_price then raise exception 'invalid_value'; end if;
  image:=case when o.metadata->>'media_rights_confirmed'='true' then o.media_url when m.media_rights_confirmed then m.hero_image_url end;
  image_asset:=case when o.metadata->>'media_rights_confirmed'='true' then o.media_asset_id when m.media_rights_confirmed then m.hero_media_asset_id end;
  if image is null or image !~ '^https://' then raise exception 'authorised_image_required'; end if;
  dropid:=coalesce(o.published_drop_id,'PD-'||to_char(now(),'YYYY')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)));
  select c.slug into slug from public.catalogue_items c where c.id=dropid;
  slug:=coalesce(slug,trim(both '-' from regexp_replace(lower(m.name||'-'||o.title),'[^a-z0-9]+','-','g'))||'-'||lower(right(dropid,8)));
  insert into public.catalogue_items(id,merchant,title,description,category,kind,city,state,location,timing,price,conditions,source,slug,detail_url,active,merchant_id,image_url,image_alt,media_status,metadata,offer_origin,exclusive)
  values(dropid,m.name,o.title,o.description,coalesce(o.category,o.vertical),case when o.vertical='events' or o.fulfilment_mode='information_only' then 'event' else 'deal' end,o.city,o.state,o.location,'See service time',case when o.deal_price is not null then '$'||o.deal_price else 'See terms' end,o.conditions,coalesce(o.booking_url,'https://perkdrop.au'),slug,'/deals/'||slug,true,m.id,image,o.title,'approved',jsonb_build_object('vertical',o.vertical,'drop_type',o.drop_type,'inventory_unit',o.inventory_unit,'fulfilment_mode',o.fulfilment_mode,'merchant_offer_id',o.id,'merchant_media_asset_id',image_asset,'media_review_status','approved'),'merchant_submitted',o.exclusive)
  on conflict(id) do update set title=excluded.title,description=excluded.description,category=excluded.category,kind=excluded.kind,city=excluded.city,state=excluded.state,location=excluded.location,price=excluded.price,conditions=excluded.conditions,source=excluded.source,active=true,image_url=excluded.image_url,media_status=excluded.media_status,metadata=excluded.metadata,updated_at=now();
  update public.merchant_offers set status='active',action_type=case when o.fulfilment_mode='information_only' then 'ticket_link' when o.fulfilment_mode='external_booking' then 'booking' else o.action_type end,published_drop_id=dropid,metadata=metadata||jsonb_build_object('requires_review',false,'published_by',p_actor,'published_at',now()),updated_at=now() where id=o.id returning * into o;
  return to_jsonb(o);
end $$;
revoke all on function public.marketplace_publish(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.marketplace_publish(uuid,uuid,uuid) to service_role;
