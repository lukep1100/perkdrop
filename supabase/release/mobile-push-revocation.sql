-- A revoked device must stop receiving even when revocation originates on the web.
-- These triggers run as the existing caller, never as a new elevated identity.
create or replace function public.mobile_revoke_device_push()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if TG_OP='DELETE' then
    update public.mobile_push_subscriptions set enabled=false,updated_at=now()
      where device_hash=OLD.credential_hash and consumer_id=OLD.consumer_id;
    return OLD;
  end if;
  if NEW.revoked_at is not null or NEW.credential_hash is distinct from OLD.credential_hash or NEW.consumer_id is distinct from OLD.consumer_id then
    update public.mobile_push_subscriptions set enabled=false,updated_at=now()
      where device_hash=OLD.credential_hash and consumer_id=OLD.consumer_id;
  end if;
  return NEW;
end $$;
create or replace function public.mobile_rotate_primary_push()
returns trigger language plpgsql security invoker set search_path='' as $$
begin
  if NEW.credential_hash is distinct from OLD.credential_hash then
    update public.mobile_push_subscriptions set enabled=false,updated_at=now()
      where device_hash=OLD.credential_hash and consumer_id=OLD.id;
  end if;
  return NEW;
end $$;
revoke all on function public.mobile_revoke_device_push(),public.mobile_rotate_primary_push() from public,anon,authenticated;
grant execute on function public.mobile_revoke_device_push(),public.mobile_rotate_primary_push() to service_role;
drop trigger if exists mobile_device_push_revocation on public.marketplace_devices;
create trigger mobile_device_push_revocation after update or delete on public.marketplace_devices
for each row execute function public.mobile_revoke_device_push();
drop trigger if exists mobile_primary_push_rotation on public.marketplace_consumers;
create trigger mobile_primary_push_rotation after update of credential_hash on public.marketplace_consumers
for each row execute function public.mobile_rotate_primary_push();
