-- Preserve scheduled candidate discovery while the event price classifier is repaired.
-- A high-confidence candidate marked FREE can describe an umbrella event whose
-- organiser labels the event ticketed and prices individual sessions separately.
-- Continue reviewing candidates and publishing only after source-level checks.
alter table public.deal_candidates disable trigger deal_candidates_auto_publish_event;
