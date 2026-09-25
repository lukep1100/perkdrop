-- Explicit, short-lived device pairing; never reuse the legacy transfer token.
create table public.marketplace_devices(
 credential_hash text primary key check(credential_hash ~ '^[a-f0-9]{64}$'),
 consumer_id uuid not null references public.marketplace_consumers(id),
 label text not null default 'Connected device' check(length(label)<=80),
 created_at timestamptz not null default now(),revoked_at timestamptz
);
create index marketplace_devices_consumer_idx on public.marketplace_devices(consumer_id);
create table public.marketplace_device_links(
 token_hash text primary key check(token_hash ~ '^[a-f0-9]{64}$'),consumer_id uuid not null references public.marketplace_consumers(id),
 expires_at timestamptz not null,used_at timestamptz,created_at timestamptz not null default now()
);
create index marketplace_device_links_consumer_idx on public.marketplace_device_links(consumer_id);
alter table public.marketplace_devices enable row level security;
alter table public.marketplace_device_links enable row level security;
revoke all on public.marketplace_devices,public.marketplace_device_links from public,anon,authenticated;
grant select,insert,update,delete on public.marketplace_devices,public.marketplace_device_links to service_role;
create or replace function public.marketplace_identity(p_hash text) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare cid uuid; revoked timestamptz;
begin
 if p_hash is null or p_hash !~ '^[a-f0-9]{64}$' then raise exception 'identity_required'; end if;
 select consumer_id,revoked_at into cid,revoked from public.marketplace_devices where credential_hash=p_hash;
 if found then
  if revoked is not null then raise exception 'identity_required'; end if;
  return cid;
 end if;
 insert into public.marketplace_consumers(credential_hash) values(p_hash) on conflict(credential_hash) do nothing;
 select id into cid from public.marketplace_consumers where credential_hash=p_hash;
 return cid;
end $$;
create function public.marketplace_connect_device(p_token_hash text,p_new_hash text,p_label text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare link public.marketplace_device_links%rowtype;
begin
 if p_new_hash is null or p_new_hash !~ '^[a-f0-9]{64}$' then return false; end if;
 select * into link from public.marketplace_device_links where token_hash=p_token_hash for update;
 if not found or link.used_at is not null or link.expires_at<=now() then return false; end if;
 if exists(select 1 from public.marketplace_consumers where credential_hash=p_new_hash) or exists(select 1 from public.marketplace_devices where credential_hash=p_new_hash) then return false; end if;
 perform 1 from public.marketplace_consumers where id=link.consumer_id for update;
 if (select count(*) from public.marketplace_devices where consumer_id=link.consumer_id and revoked_at is null)>=10 then return false; end if;
 insert into public.marketplace_devices(credential_hash,consumer_id,label) values(p_new_hash,link.consumer_id,left(coalesce(nullif(trim(p_label),''),'Connected device'),80));
 update public.marketplace_device_links set used_at=now() where token_hash=p_token_hash;
 return true;
end $$;
revoke all on function public.marketplace_connect_device(text,text,text) from public,anon,authenticated;
grant execute on function public.marketplace_connect_device(text,text,text) to service_role;
