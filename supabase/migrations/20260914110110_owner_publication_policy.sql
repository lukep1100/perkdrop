-- Owner publication policy. Evidence stays private; no records/bookings are deleted.
-- The current CLI migration-new failed with AlreadyExists on Windows; timestamp is UTC.
create table public.business_requests (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid references public.merchants(id),
  business_name text not null,
  branch_location text not null default '',
  official_url text not null default '',
  request_kind text not null check(request_kind in ('business_optout','listing_removal','photo_removal','delivery_failure','ambiguous')),
  match_state text not null check(match_state in ('confirmed','unmatched','ambiguous')),
  original_request text not null check(length(btrim(original_request)) between 3 and 1500),
  request_reference text not null unique check(length(btrim(request_reference))>=3),
  match_basis text not null check(length(btrim(match_basis))>=3),
  recipient text,
  failure_class text check(failure_class in ('permanent','temporary','unknown')),
  policy_basis text,
  status text not null default 'pending' check(status in ('pending','applied','reviewing','resolved')),
  resolution_reason text, resolution_evidence text,
  commitments_flagged integer not null default 0,
  created_at timestamptz not null default now(), applied_at timestamptz,
  check(status<>'resolved' or (coalesce(length(btrim(resolution_reason)),0)>=3 and coalesce(length(btrim(resolution_evidence)),0)>=3))
);
alter table public.business_requests enable row level security;
revoke all on public.business_requests from public,anon,authenticated;
grant select,insert,update on public.business_requests to service_role;
create index business_request_identity on public.business_requests(lower(btrim(business_name)),lower(btrim(branch_location))) where match_state='confirmed';

create or replace function public.guard_directory_reimport()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.directory_exclusions e where e.merchant_id=new.id or e.slug=new.slug
    or (e.normalized_location<>'' and e.normalized_name=lower(btrim(new.name)) and e.normalized_location=lower(btrim(new.primary_location))))
    or exists(select 1 from public.business_requests r where r.match_state='confirmed'
      and r.request_kind in ('business_optout','listing_removal') and r.status in ('applied','resolved')
      and (r.merchant_id=new.id or (lower(btrim(r.business_name))=lower(btrim(new.name))
        and r.branch_location<>'' and lower(btrim(r.branch_location))=lower(btrim(new.primary_location))))) then
    new.directory_status:='removed';new.permanent_listing:=false;new.claimable:=false;new.do_not_contact:=true;
  end if;
  -- Failed delivery blocks alternate-address attempts, never publication by itself.
  if exists(select 1 from public.business_requests r where r.match_state='confirmed' and r.request_kind='delivery_failure'
    and (r.merchant_id=new.id or (lower(btrim(r.business_name))=lower(btrim(new.name))
      and r.branch_location<>'' and lower(btrim(r.branch_location))=lower(btrim(new.primary_location))))) then
    new.do_not_contact:=true;
  end if;
  return new;
end $$;

create function public.propagate_business_visibility()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.do_not_contact then
    update public.outreach_messages set status='suppressed',updated_at=now() where merchant_id=new.id and status in ('draft','approved');
  end if;
  if new.directory_status='removed' or not new.permanent_listing then
    update public.catalogue_items set active=false where merchant_id=new.id and active;
    -- Keep status, capacity, reservations, memberships and redemption records intact.
    update public.merchant_offers set visibility='private' where merchant_id=new.id and visibility<>'private';
  end if;
  return new;
end $$;
create trigger business_visibility_propagate after update of directory_status,permanent_listing,do_not_contact on public.merchants
for each row execute function public.propagate_business_visibility();

create function public.guard_excluded_offer_publication()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.merchants where id=new.merchant_id and (directory_status='removed' or not permanent_listing)) then
    if tg_table_name='catalogue_items' then new.active:=false;new.featured:=false;new.hot:=false;
    else new.visibility:='private'; end if;
  end if;
  if tg_table_name='catalogue_items' and new.merchant_id is null then
    if exists(select 1 from public.business_requests r where r.match_state='confirmed' and r.request_kind in ('business_optout','listing_removal')
      and r.status in ('applied','resolved') and lower(btrim(r.business_name))=lower(btrim(new.merchant))
      and r.branch_location<>'' and lower(btrim(r.branch_location))=lower(btrim(new.location))) then
      new.active:=false;new.featured:=false;new.hot:=false;
    end if;
  end if;
  return new;
end $$;
create trigger catalogue_exclusion_guard before insert or update on public.catalogue_items for each row execute function public.guard_excluded_offer_publication();
create trigger merchant_offer_exclusion_guard before insert or update on public.merchant_offers for each row execute function public.guard_excluded_offer_publication();

create function public.record_business_request(p_request jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare r public.business_requests; mid uuid:=nullif(p_request->>'merchant_id','')::uuid; affected integer:=0;
begin
  if mid is not null then perform 1 from public.merchants where id=mid for update; if not found then raise exception 'merchant_not_found'; end if; end if;
  insert into public.business_requests(merchant_id,business_name,branch_location,official_url,request_kind,match_state,original_request,request_reference,match_basis,recipient,failure_class)
    values(mid,p_request->>'business_name',coalesce(p_request->>'branch_location',''),coalesce(p_request->>'official_url',''),p_request->>'request_kind',p_request->>'match_state',p_request->>'original_request',p_request->>'request_reference',p_request->>'match_basis',nullif(lower(btrim(p_request->>'recipient')),''),p_request->>'failure_class')
    on conflict(request_reference) do nothing returning * into r;
  if not found then select id into r.id from public.business_requests where request_reference=p_request->>'request_reference';return r.id; end if;
  if r.recipient is not null and r.request_kind in ('business_optout','listing_removal','delivery_failure') then
    insert into public.outreach_suppression(email,merchant_id,reason,source)
      values(r.recipient,mid,case when r.request_kind='delivery_failure' then case when r.failure_class='permanent' then 'invalid' else 'manual' end else 'unsubscribe' end,'business_request:'||r.id)
      on conflict(email) do update set merchant_id=coalesce(excluded.merchant_id,public.outreach_suppression.merchant_id);
  end if;
  -- Exact recipient suppression is safe even when its branch identity still needs review.
  if r.match_state<>'confirmed' then return r.id; end if;
  if r.merchant_id is null and (btrim(r.business_name)='' or (r.branch_location='' and r.official_url='')) then raise exception 'confirmed_identity_required'; end if;
  if r.request_kind in ('business_optout','listing_removal','delivery_failure') then
    update public.merchants set do_not_contact=true where id=mid;
  end if;
  if r.request_kind in ('business_optout','listing_removal') then
    if mid is not null then
      select count(*) into affected from public.redemptions where merchant_id=mid and status in ('pending','created','booked','confirmed');
      perform public.record_directory_removal(mid,case when r.request_kind='business_optout' then 'Owner publication policy following business marketing opt-out' else 'Explicit listing removal request' end,r.request_reference);
    end if;
    update public.business_requests set status='applied',applied_at=now(),commitments_flagged=affected,
      policy_basis=case when r.request_kind='business_optout' then 'owner_publication_policy' else 'explicit_listing_removal' end where id=r.id;
  elsif r.request_kind='delivery_failure' then
    update public.business_requests set status='applied',applied_at=now(),policy_basis='delivery_suppression_only' where id=r.id;
  end if;
  -- Photo requests require a staff-selected asset/scope; never remove every photo blindly.
  return r.id;
end $$;
revoke all on function public.record_business_request(jsonb) from public,anon,authenticated;
grant execute on function public.record_business_request(jsonb) to service_role;

create or replace function public.unsubscribe_outreach(p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare msg public.outreach_messages; m public.merchants;
begin
  select * into msg from public.outreach_messages where unsubscribe_token=p_token;
  if not found then return false; end if;
  select * into m from public.merchants where id=msg.merchant_id;
  perform public.record_business_request(jsonb_build_object('merchant_id',m.id,'business_name',m.name,'branch_location',coalesce(m.primary_location,''),'official_url',coalesce(m.website_url,''),
    'request_kind','business_optout','match_state','confirmed','original_request','Confirmed marketing unsubscribe using the business-specific unsubscribe form.',
    'request_reference','unsubscribe-message:'||msg.id,'match_basis','Business-specific message token, confirmed POST; original marketing opt-out retained separately from owner publication policy.','recipient',msg.email));
  update public.outreach_messages set status='unsubscribed',updated_at=now() where id=msg.id;
  update public.outreach_contacts set status='unsubscribed',unsubscribe_at=coalesce(unsubscribe_at,now()),updated_at=now() where lower(btrim(email))=lower(btrim(msg.email));
  return true;
end $$;

-- Classify failures, not just hard bounces. An unclassified failure stays unknown.
create or replace function public.record_permanent_bounce()
returns trigger language plpgsql security definer set search_path='' as $$
declare m public.merchants; failure text;
begin
  if new.status not in ('bounced','failed') then return new; end if;
  failure:=case when new.metadata->>'bounce_type' in ('permanent','hard') then 'permanent' when new.metadata->>'bounce_type' in ('temporary','soft') then 'temporary' else 'unknown' end;
  select * into m from public.merchants where id=new.merchant_id;
  perform public.record_business_request(jsonb_build_object('merchant_id',m.id,'business_name',coalesce(m.name,'Unmatched delivery recipient'),'branch_location',coalesce(m.primary_location,''),'request_kind','delivery_failure','match_state',case when m.id is null then 'unmatched' else 'confirmed' end,
    'original_request','Delivery failure; not a business removal request. Classification: '||failure,'request_reference','delivery-message:'||new.id,
    'match_basis','Recipient linked to the specific queued business message.','recipient',new.email,'failure_class',failure));
  return new;
end $$;

alter table public.listing_reports add column category text not null default 'reported_issue'
  check(category in ('due_review','reported_issue','source_conflict','missing_service','photo_permission','business_authority','business_optout'));
alter table public.listing_reports add column resolution_evidence text;
alter table public.listing_reports add constraint report_resolution_evidence check(status not in ('resolved','dismissed') or
  (coalesce(length(btrim(review_note)),0)>=3 and coalesce(length(btrim(resolution_evidence)),0)>=3)) not valid;
revoke all on function public.guard_directory_reimport(),public.propagate_business_visibility(),public.guard_excluded_offer_publication(),public.record_permanent_bounce() from public,anon,authenticated;

-- A public business URL alone is not personal authority evidence.
create function public.require_claim_authority_note()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if coalesce(length(btrim(new.evidence_notes)),0)<15 then raise exception 'authority_evidence_required'; end if;
  return new;
end $$;
create trigger claim_authority_note before insert on public.merchant_claims for each row execute function public.require_claim_authority_note();
revoke all on function public.require_claim_authority_note() from public,anon,authenticated;

create function public.approve_business_claim(p_claim_id uuid,p_actor uuid,p_reason text,p_evidence text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.merchant_claims; m public.merchants; actor_email text;
begin
  select lower(email) into actor_email from auth.users where id=p_actor and email_confirmed_at is not null;
  if actor_email is distinct from 'perkdropofficial@gmail.com' then raise exception 'admin_required'; end if;
  if coalesce(length(btrim(p_reason)),0)<3 or coalesce(length(btrim(p_evidence)),0)<3 then raise exception 'review_evidence_required'; end if;
  select * into c from public.merchant_claims where id=p_claim_id for update;
  if not found or c.status<>'pending' then raise exception 'claim_not_pending'; end if;
  select * into m from public.merchants where id=c.merchant_id for update;
  if not m.permanent_listing or m.directory_status='removed' then raise exception 'business_excluded'; end if;
  if not exists(select 1 from auth.users where id=c.user_id and email_confirmed_at is not null and lower(email)=lower(c.contact_email)) then raise exception 'verified_claimant_required'; end if;
  if exists(select 1 from public.merchant_members where merchant_id=c.merchant_id and (user_id=c.user_id or (role='owner' and status='active'))) then raise exception 'ownership_review_required'; end if;
  insert into public.merchant_members(merchant_id,user_id,role,status) values(c.merchant_id,c.user_id,'owner','active');
  update public.merchant_claims set status='approved',reviewed_at=now(),reviewed_by=actor_email,
    metadata=metadata||jsonb_build_object('review_reason',left(p_reason,1000),'review_evidence',left(p_evidence,1500)) where id=c.id;
  update public.merchants set listing_status='verified',claimable=false,verified_at=now() where id=c.merchant_id;
  insert into public.merchant_notification_outbox(merchant_id,event_type,recipient_email,payload)
    values(c.merchant_id,'claim_approved',c.contact_email,jsonb_build_object('claim_id',c.id,'merchant_name',m.name));
  return jsonb_build_object('status','approved','membership_created',true,'notification','queued_not_delivered');
end $$;
revoke all on function public.approve_business_claim(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.approve_business_claim(uuid,uuid,text,text) to service_role;
