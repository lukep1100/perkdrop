-- Additive marketplace taxonomy expansion. Existing offers and Union Hotel data remain unchanged.
-- Keep legacy aliases already present in production while allowing the mission's
-- hair, golf, tourism, drinks and services inventory categories.
alter table public.merchant_offers drop constraint if exists merchant_offers_vertical_check;
alter table public.merchant_offers add constraint merchant_offers_vertical_check
  check (vertical in (
    'food','drinks','events','beauty','wellness','hair','fitness',
    'experiences','activities','golf','tourism','stay','shopping','free',
    'services','other','family_kids','travel_stays','freebies'
  )) not valid;

alter table public.merchant_offers drop constraint if exists merchant_offers_inventory_unit_check;
alter table public.merchant_offers add constraint merchant_offers_inventory_unit_check
  check (inventory_unit in (
    'diner','person','ticket','appointment','booking','room','tee_time',
    'class_spot','player','seat','item','package','other'
  )) not valid;
