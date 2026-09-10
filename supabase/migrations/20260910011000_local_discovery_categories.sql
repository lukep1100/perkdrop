-- Additive taxonomy expansion. Existing offers, including Union Hotel, remain unchanged.
alter table public.merchant_offers drop constraint if exists merchant_offers_vertical_check;
alter table public.merchant_offers add constraint merchant_offers_vertical_check
  check (vertical in ('food','events','beauty','wellness','experiences','activities','fitness','stay','shopping','free','other','family_kids','travel_stays','freebies','services')) not valid;

alter table public.merchant_offers drop constraint if exists merchant_offers_discount_type_check;
alter table public.merchant_offers add constraint merchant_offers_discount_type_check
  check (discount_type in ('percent','fixed','deal_price','free','bogo','custom','value_add')) not valid;

create index if not exists merchant_offers_city_vertical_active_idx
  on public.merchant_offers (city, vertical, status, starts_at, ends_at);
