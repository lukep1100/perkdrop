do $$ begin
 alter table public.merchant_members drop constraint if exists merchant_members_role_check;
 alter table public.merchant_members add constraint merchant_members_role_check check(role in ('owner','admin','manager','editor','floor','viewer','analyst'));
exception when duplicate_object then null; end $$;
