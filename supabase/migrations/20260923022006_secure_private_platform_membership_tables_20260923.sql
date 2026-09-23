-- Applied to production on 23 September 2026. These server-owned tables have
-- no public client access; service-role operations retain their existing path.
alter table public.platform_settings enable row level security;
alter table public.consumer_memberships enable row level security;
alter table public.member_credit_ledger enable row level security;

revoke all privileges on table public.platform_settings,
  public.consumer_memberships, public.member_credit_ledger
  from anon, authenticated;
