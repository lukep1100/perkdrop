-- Cover the registry foreign key used while contacts are updated or deleted.
create index if not exists outreach_email_registry_contact_id_idx
  on public.outreach_email_registry (primary_contact_id);
