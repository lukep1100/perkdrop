create index if not exists marketplace_outbox_merchant_idx on public.marketplace_outbox(merchant_id);
create index if not exists marketplace_outbox_offer_idx on public.marketplace_outbox(offer_id);
create index if not exists marketplace_outbox_watch_idx on public.marketplace_outbox(watch_id);
