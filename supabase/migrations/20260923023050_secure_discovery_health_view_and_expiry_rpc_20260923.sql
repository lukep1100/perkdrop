-- Applied to production on 23 September 2026. Internal state-health data
-- and catalogue expiry operations are available to server-side roles only.
alter view public.discovery_state_health set (security_invoker = true);
revoke all privileges on table public.discovery_state_health from anon, authenticated;
revoke execute on function public.expire_catalogue_items() from public, anon, authenticated;
