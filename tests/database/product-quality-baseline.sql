-- Read-only production schema export, 2026-09-14. Synthetic rows only in the local runner.
create schema if not exists auth;
create table if not exists auth.users(id uuid primary key);
alter table auth.users add column if not exists email text;
alter table auth.users add column if not exists email_confirmed_at timestamptz;
create table public.merchant_claims (id uuid default gen_random_uuid() not null, merchant_id uuid not null, drop_id text, user_id uuid, contact_name text not null, contact_email text not null, contact_phone text, business_role text, evidence_url text, evidence_notes text, status text default 'pending'::text not null, source_channel text default 'web'::text not null, reviewed_at timestamp with time zone, reviewed_by text, metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, terms_version text, terms_accepted_at timestamp with time zone);
create table public.outreach_contacts (id uuid default gen_random_uuid() not null, merchant_id uuid not null, contact_name text, contact_role text, email text, phone text, source_url text not null, consent_basis text default 'unknown'::text not null, role_relevance_notes text, marketing_prohibited_at_source boolean default false not null, status text default 'research'::text not null, first_contacted_at timestamp with time zone, last_contacted_at timestamp with time zone, contact_count integer default 0 not null, unsubscribe_at timestamp with time zone, metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null, response text, follow_up_date date, outcome text);
create table public.outreach_messages (id uuid default gen_random_uuid() not null, merchant_id uuid not null, contact_id uuid, email text not null, message_type text default 'claim_invite'::text not null, consent_basis text not null, subject text not null, body_text text not null, claim_url text, unsubscribe_token uuid default gen_random_uuid() not null, status text default 'draft'::text not null, sent_at timestamp with time zone, provider_message_id text, metadata jsonb default '{}'::jsonb not null, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.outreach_suppression (id uuid default gen_random_uuid() not null, email text, merchant_id uuid, reason text not null, source text, created_at timestamp with time zone default now() not null);
alter table public.merchant_claims add primary key(id);
alter table public.outreach_contacts add primary key(id);
alter table public.outreach_messages add primary key(id);
alter table public.outreach_suppression add primary key(id);
alter table public.outreach_suppression add unique(email), add check(reason in ('unsubscribe','complaint','no_marketing_notice','invalid','manual','legal_hold'));
alter table public.outreach_contacts add unique(merchant_id,email), add check(status in ('research','eligible','contacted','responded','claimed','unsubscribed','suppressed','invalid'));
alter table public.outreach_messages add unique(unsubscribe_token), add check(status in ('draft','approved','sent','delivered','bounced','unsubscribed','suppressed','failed'));
alter table public.merchant_claims add check(status in ('pending','approved','rejected','withdrawn'));

