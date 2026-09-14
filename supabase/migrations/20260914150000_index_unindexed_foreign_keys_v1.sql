-- Cover the remaining public foreign keys reported by the Supabase performance advisor.
-- These indexes are additive and do not change row visibility or write semantics.
create index if not exists business_requests_merchant_id_idx
  on public.business_requests (merchant_id);

create index if not exists listing_reports_catalogue_item_id_idx
  on public.listing_reports (catalogue_item_id);

create index if not exists listing_reports_merchant_id_idx
  on public.listing_reports (merchant_id);
