-- Reversible, non-destructive protections. No outreach or social jobs are created.
create unique index if not exists outreach_suppression_normalized_email
  on public.outreach_suppression(lower(btrim(email)));
create unique index if not exists merchant_one_pending_claim
  on public.merchant_claims(merchant_id) where status='pending';

create or replace function public.outreach_is_suppressed(p_email text,p_merchant_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.outreach_suppression s where lower(btrim(s.email))=lower(btrim(p_email)))
    or exists(select 1 from public.merchants m where m.id=p_merchant_id and m.do_not_contact)
    or exists(select 1 from public.outreach_contacts c where lower(btrim(c.email))=lower(btrim(p_email))
      and (c.status in ('invalid','unsubscribed','suppressed') or c.unsubscribe_at is not null
        or c.marketing_prohibited_at_source or c.consent_basis='do_not_contact'));
$$;
revoke all on function public.outreach_is_suppressed(text,uuid) from public,anon,authenticated;
grant execute on function public.outreach_is_suppressed(text,uuid) to service_role;

create or replace function public.guard_outreach_suppression()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.email:=lower(btrim(new.email));
  perform pg_advisory_xact_lock(hashtextextended('outreach-suppression:'||new.email,0));
  return new;
end $$;
create trigger outreach_suppression_normalize before insert or update on public.outreach_suppression
for each row execute function public.guard_outreach_suppression();

create or replace function public.propagate_outreach_suppression()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  update public.outreach_contacts set status='suppressed',updated_at=now(),
    metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('suppression_guard',true,'status_before_suppression',status)
    where lower(btrim(email))=lower(btrim(new.email)) and status not in ('invalid','unsubscribed','suppressed');
  update public.outreach_messages set status='suppressed',updated_at=now()
    where lower(btrim(email))=lower(btrim(new.email)) and status in ('draft','approved');
  return new;
end $$;
create trigger outreach_suppression_propagate after insert or update on public.outreach_suppression
for each row execute function public.propagate_outreach_suppression();

create or replace function public.guard_outreach_contact_status()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email is null or btrim(new.email)='' then return new; end if;
  new.email:=lower(btrim(new.email));
  perform pg_advisory_xact_lock(hashtextextended('outreach-suppression:'||new.email,0));
  if new.status not in ('invalid','unsubscribed','suppressed') and
    (new.unsubscribe_at is not null or new.marketing_prohibited_at_source or new.consent_basis='do_not_contact' or public.outreach_is_suppressed(new.email,new.merchant_id)) then
    new.metadata:=coalesce(new.metadata,'{}'::jsonb)||jsonb_build_object('suppression_guard',true,'status_before_suppression',new.status);
    new.status:='suppressed';
  end if;
  return new;
end $$;
create trigger outreach_contact_suppression before insert or update on public.outreach_contacts
for each row execute function public.guard_outreach_contact_status();

create or replace function public.record_contact_suppression()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.email is not null and btrim(new.email)<>'' and new.status in ('invalid','unsubscribed','suppressed') then
    insert into public.outreach_suppression(email,merchant_id,reason,source)
      values(new.email,new.merchant_id,case when new.status='invalid' then 'invalid' when new.status='unsubscribed' or new.unsubscribe_at is not null then 'unsubscribe' else 'manual' end,'contact_status_guard') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger outreach_contact_record_suppression after insert or update on public.outreach_contacts
for each row execute function public.record_contact_suppression();

create or replace function public.guard_outreach_message_status()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  new.email:=lower(btrim(new.email));
  perform pg_advisory_xact_lock(hashtextextended('outreach-suppression:'||new.email,0));
  if new.status in ('draft','approved','sent') and public.outreach_is_suppressed(new.email,new.merchant_id) then
    if new.status='sent' and (tg_op='INSERT' or old.status is distinct from 'sent') then raise exception 'outreach_suppressed'; end if;
    if new.status in ('draft','approved') then new.status:='suppressed'; end if;
  end if;
  return new;
end $$;
create trigger outreach_message_suppression before insert or update on public.outreach_messages
for each row execute function public.guard_outreach_message_status();

create or replace function public.record_permanent_bounce()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='bounced' and coalesce(new.metadata->>'bounce_type','') in ('permanent','hard') then
    insert into public.outreach_suppression(email,merchant_id,reason,source)
      values(new.email,new.merchant_id,'invalid','permanent_bounce_guard') on conflict do nothing;
  end if;
  return new;
end $$;
create trigger outreach_record_permanent_bounce after insert or update on public.outreach_messages
for each row execute function public.record_permanent_bounce();

create or replace function public.unsubscribe_outreach(p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare msg public.outreach_messages;
begin
  select * into msg from public.outreach_messages where unsubscribe_token=p_token;
  if not found then return false; end if;
  insert into public.outreach_suppression(email,merchant_id,reason,source)
    values(lower(btrim(msg.email)),msg.merchant_id,'unsubscribe','perkdrop-unsubscribe') on conflict do nothing;
  update public.outreach_messages set status='unsubscribed',updated_at=now() where id=msg.id;
  update public.outreach_contacts set status='unsubscribed',unsubscribe_at=coalesce(unsubscribe_at,now()),updated_at=now()
    where lower(btrim(email))=lower(btrim(msg.email));
  -- Marketing opt-out is not a request to remove a public directory listing.
  update public.merchants set do_not_contact=true where id=msg.merchant_id;
  update public.outreach_messages set status='suppressed',updated_at=now()
    where merchant_id=msg.merchant_id and status in ('draft','approved');
  return true;
end $$;
revoke all on function public.unsubscribe_outreach(uuid) from public,anon,authenticated;
grant execute on function public.unsubscribe_outreach(uuid) to service_role;

-- Durable explicit removal evidence, separate from communication preferences.
create table if not exists public.directory_exclusions (
  merchant_id uuid primary key references public.merchants(id),
  slug text not null, normalized_name text not null, normalized_location text not null,
  reason text not null, request_reference text not null,
  created_at timestamptz not null default now()
);
alter table public.directory_exclusions enable row level security;
revoke all on public.directory_exclusions from public,anon,authenticated;
grant select,insert,update on public.directory_exclusions to service_role;
create index if not exists directory_exclusion_slug on public.directory_exclusions(slug);
create index if not exists directory_exclusion_identity on public.directory_exclusions(normalized_name,normalized_location);
create or replace function public.record_directory_removal(p_merchant_id uuid,p_reason text,p_request_reference text)
returns void language plpgsql security definer set search_path='' as $$
declare m public.merchants;
begin
  if length(btrim(p_reason))<3 or length(btrim(p_request_reference))<3 then raise exception 'removal_evidence_required'; end if;
  select * into m from public.merchants where id=p_merchant_id for update;
  if not found then raise exception 'merchant_not_found'; end if;
  insert into public.directory_exclusions(merchant_id,slug,normalized_name,normalized_location,reason,request_reference)
    values(m.id,m.slug,lower(btrim(m.name)),lower(btrim(coalesce(m.primary_location,''))),p_reason,p_request_reference)
    on conflict(merchant_id) do update set reason=excluded.reason,request_reference=excluded.request_reference;
  update public.merchants set directory_status='removed',permanent_listing=false,claimable=false where id=m.id;
  update public.catalogue_items set active=false where merchant_id=m.id and active;
end $$;
revoke all on function public.record_directory_removal(uuid,text,text) from public,anon,authenticated;
grant execute on function public.record_directory_removal(uuid,text,text) to service_role;
create or replace function public.guard_directory_reimport()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if exists(select 1 from public.directory_exclusions e where e.merchant_id=new.id or e.slug=new.slug
    or (e.normalized_location<>'' and e.normalized_name=lower(btrim(new.name)) and e.normalized_location=lower(btrim(new.primary_location)))) then
    new.directory_status:='removed';new.permanent_listing:=false;new.claimable:=false;
  end if;
  return new;
end $$;
create trigger directory_reimport_guard before insert or update on public.merchants
for each row execute function public.guard_directory_reimport();

create or replace function public.submit_business_claim(p_merchant_id uuid,p_user_id uuid,p_claim jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.merchants; result_id uuid; account_email text; accepted_at timestamptz:=now();
begin
  select lower(email) into account_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  if account_email is null then raise exception 'verified_email_required'; end if;
  select * into m from public.merchants where id=p_merchant_id for update;
  if not found or not m.permanent_listing or m.directory_status='removed' then raise exception 'merchant_not_found'; end if;
  select id into result_id from public.merchant_claims where merchant_id=m.id and user_id=p_user_id and status='pending';
  if found then return jsonb_build_object('id',result_id,'created',false); end if;
  if m.listing_status<>'unclaimed' or not m.claimable then raise exception 'listing_not_claimable'; end if;
  if length(btrim(coalesce(p_claim->>'contact_name','')))<1 or length(btrim(coalesce(p_claim->>'business_role','')))<1 then raise exception 'missing_required_fields'; end if;
  if p_claim->>'terms_accepted' is distinct from 'true' or p_claim->>'privacy_acknowledged' is distinct from 'true' then raise exception 'merchant_terms_and_privacy_required'; end if;
  insert into public.merchant_claims(merchant_id,user_id,contact_name,contact_email,contact_phone,business_role,evidence_url,evidence_notes,status,source_channel,terms_version,terms_accepted_at,metadata)
    values(m.id,p_user_id,left(p_claim->>'contact_name',160),account_email,nullif(left(p_claim->>'contact_phone',80),''),left(p_claim->>'business_role',120),nullif(left(p_claim->>'evidence_url',1200),''),nullif(left(p_claim->>'evidence_notes',1800),''),'pending','merchant_portal','2026-08-30-v1',accepted_at,jsonb_build_object('privacy_acknowledged_at',accepted_at)) returning id into result_id;
  update public.merchants set listing_status='claim_pending',claimable=false where id=m.id;
  return jsonb_build_object('id',result_id,'created',true);
end $$;
revoke all on function public.submit_business_claim(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.submit_business_claim(uuid,uuid,jsonb) to service_role;

-- Repair only contradictions proven by current suppression rows. Preserve prior status in metadata.
create or replace function public.accept_business_invite(p_token_hash text,p_user_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare invitation public.merchant_invites; account_email text;
begin
  select lower(btrim(email)) into account_email from auth.users where id=p_user_id and email_confirmed_at is not null;
  if account_email is null then raise exception 'verified_email_required'; end if;
  select * into invitation from public.merchant_invites where token_hash=p_token_hash for update;
  if not found then raise exception 'invite_invalid'; end if;
  if lower(btrim(invitation.email)) is distinct from account_email then raise exception 'invite_email_mismatch'; end if;
  if invitation.revoked_at is not null then raise exception 'invite_revoked'; end if;
  if invitation.accepted_at is not null then raise exception 'invite_used'; end if;
  if invitation.expires_at<=now() then raise exception 'invite_expired'; end if;
  -- An invite must not demote an existing owner or reactivate a suspended member.
  if exists(select 1 from public.merchant_members where merchant_id=invitation.merchant_id and user_id=p_user_id) then raise exception 'membership_already_exists'; end if;
  insert into public.merchant_members(merchant_id,user_id,role,status) values(invitation.merchant_id,p_user_id,invitation.role,'active');
  update public.merchant_invites set accepted_at=now(),accepted_by=p_user_id where id=invitation.id;
  return jsonb_build_object('merchant_id',invitation.merchant_id,'role',invitation.role,'invite_id',invitation.id);
end $$;
revoke all on function public.accept_business_invite(text,uuid) from public,anon,authenticated;
grant execute on function public.accept_business_invite(text,uuid) to service_role;

update public.outreach_contacts c set status='suppressed',updated_at=now(),
  metadata=coalesce(c.metadata,'{}'::jsonb)||jsonb_build_object('quality_audit','2026-09-14','status_before_suppression',c.status)
where c.status not in ('invalid','unsubscribed','suppressed') and public.outreach_is_suppressed(c.email,c.merchant_id);

-- Exact-address and merchant-authorised source only; no inferred suburb-centre pins.
update public.merchants m set latitude=d.latitude,longitude=d.longitude,
  metadata=coalesce(m.metadata,'{}'::jsonb)||jsonb_build_object('coordinate_source','linked_merchant_authorised_offer','coordinate_source_id',d.id,'coordinate_repaired_at',now())
from public.catalogue_items d where d.merchant_id=m.id and m.slug='union-hotel-adelaide'
  and m.primary_location=d.location and m.latitude is null and m.longitude is null
  and d.id='UNION-HOTEL-LUNCH-20-OFF' and d.latitude between -44 and -10 and d.longitude between 112 and 154;

update public.catalogue_items set metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('image_unavailable',true,'image_checked_at','2026-09-14','image_check_reason','upstream_http_failure')
where image_url in ('https://static.where-e.com/Australia/South_Australia/Adelaide/Opsm-Adelaide-Rundle-Mall_7898d9b320b87dfa6e8a04397370c58f.jpg','https://www.swellsculpture.com.au/wp-content/uploads/Jina-Lee_Evolution_Image-by-Leximagery.jpg');

-- Trigger functions are not public RPCs.
revoke all on function public.guard_outreach_suppression(),public.propagate_outreach_suppression(),public.guard_outreach_contact_status(),public.guard_outreach_message_status(),public.guard_directory_reimport(),public.record_contact_suppression(),public.record_permanent_bounce() from public,anon,authenticated;
