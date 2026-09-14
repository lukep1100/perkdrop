-- Keep the database event contract aligned with the public tracking endpoint.
-- The new events contain public listing identifiers, never claim credentials.
alter table public.engagement_events drop constraint engagement_events_event_type_check;
alter table public.engagement_events add constraint engagement_events_event_type_check check (event_type in (
  'impression','deal_view','listing_view','website_click','directions','call','save','share',
  'claim_start','claim_submit','redemption_start','redemption_complete','booking_start','booking_complete',
  'page_view','deal_open','search','save_toggle','map_open','directions_click','official_deal_click',
  'business_submit_started','business_submit_completed','claim_portal_open','paid_landing',
  'service_date_selected','party_size_selected','claim_started','hold_created','claim_issued',
  'book_table_clicked','booking_claim_confirmed','hold_expired','hold_released','subscriber_signup',
  'map_marker_open','business_open'
)) not valid;
alter table public.engagement_events validate constraint engagement_events_event_type_check;
