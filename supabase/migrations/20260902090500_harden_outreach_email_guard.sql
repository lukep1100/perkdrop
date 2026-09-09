-- Make the outreach email guard safe for BEFORE INSERT and concurrent requests.

alter table public.outreach_email_registry
  alter constraint outreach_email_registry_primary_contact_id_fkey
  deferrable initially deferred;

create or replace function public.guard_outreach_contact_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  next_key text;
  previous_key text;
  existing_contact uuid;
  replacement_contact uuid;
  key_exists boolean;
begin
  next_key := nullif(lower(btrim(new.email)), '');
  if next_key is null then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    previous_key := nullif(lower(btrim(old.email)), '');
    if previous_key = next_key then
      new.email := btrim(new.email);
      return new;
    end if;
  end if;

  select primary_contact_id into existing_contact
  from public.outreach_email_registry
  where email_key = next_key
  for update;
  key_exists := found;

  if key_exists and existing_contact is not null and existing_contact is distinct from new.id then
    raise exception using
      errcode = '23505',
      message = 'A merchant outreach contact already uses this email address.';
  elsif key_exists then
    update public.outreach_email_registry
    set primary_contact_id = new.id
    where email_key = next_key;
  else
    -- A concurrent insert for the same key raises 23505 here and fails closed.
    insert into public.outreach_email_registry (email_key, primary_contact_id)
    values (next_key, new.id);
  end if;

  if tg_op = 'UPDATE' and previous_key is not null and previous_key <> next_key then
    select id into replacement_contact
    from public.outreach_contacts
    where id <> old.id and lower(btrim(email)) = previous_key
    order by created_at, id
    limit 1;

    if replacement_contact is null then
      delete from public.outreach_email_registry
      where email_key = previous_key and primary_contact_id = old.id;
    else
      update public.outreach_email_registry
      set primary_contact_id = replacement_contact
      where email_key = previous_key and primary_contact_id = old.id;
    end if;
  end if;

  new.email := btrim(new.email);
  return new;
end;
$$;

revoke all on function public.guard_outreach_contact_email() from public, anon, authenticated;
