create table if not exists public.merchant_offer_templates (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete restrict,
  name text not null check (char_length(name) between 1 and 120),
  template_payload jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists merchant_offer_templates_merchant_idx on public.merchant_offer_templates(merchant_id, active, updated_at desc);
alter table public.merchant_offer_templates enable row level security;

create table if not exists public.demand_signals (
  id uuid primary key default gen_random_uuid(),
  city text not null,
  vertical text not null default 'other',
  drop_type text not null default 'capacity',
  inventory_unit text not null default 'person',
  quantity integer not null default 1 check (quantity between 1 and 10000),
  source text not null default 'customer_request',
  status text not null default 'open' check (status in ('open','matched','expired','cancelled')),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  expires_at timestamptz
);

create index if not exists demand_signals_open_idx on public.demand_signals(city, vertical, status, created_at desc);
alter table public.demand_signals enable row level security;
