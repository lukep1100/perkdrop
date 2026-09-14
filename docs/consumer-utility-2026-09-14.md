# PerkDrop consumer utility release — 14 September 2026

This phase improves the existing product, not its feature count. Production data and frontend changes are live and verified. No businesses were impersonated or contacted, no business claims were created, no booking capacity was held, and no social content was scheduled or published.

## 1. Tonight experience

`/tonight` and `/today` use explicit reviewed service windows, venue-state IANA timezones, exact weekdays/date instances, date bounds, exclusions, actual source-check timestamps and a 30-day freshness ceiling. Tonight means a service extending beyond 5pm with time remaining. Titles, “late”, seasonal headlines and general opening hours without applicable evidence cannot create availability. Booking inventory must match the service date and have capacity. Conditions still apply; these are evidence-backed service times, not a live guarantee that a table remains free.

17 of 43 offers have structured service windows. At 7:29pm Adelaide time on Monday 14 September, exactly **one Adelaide offer** qualifies for tonight: Grand Junction Tavern's Monday buy-one-main-get-one-free, 5–9pm, excluding public holidays. Union's lunch and Tuesday schnitzels correctly do not qualify. Fifteen distinct offers qualify for at least one service in the next seven days nationally, including nine in Adelaide; many are daytime attractions. Current GJT evidence: https://grandjunctiontavern.com.au/events/buy-1-get-1-free/

Home shows up to three useful sections, not empty feature shelves. National location selection remains; Darwin's empty Tonight result explains the limitation and offers another day/category. Capacity is still authoritative at booking, not on an old open tab. A visible-page minute refresh rechecks time boundaries without interrupting form entry.

## 2. Offer quality

| Grade | Before | After |
|---|---:|---:|
| A: strong | 8 | 17 |
| B: usable, minor work | 16 | 7 |
| C: unclear/incomplete | 14 | 14 |
| D: not prominent | 5 | 5 |

All 43 are individually classified in `data/consumer-offer-quality-2026-09-14.csv`; decisions and source URLs are retained in `data/consumer-offer-decisions-2026-09-14.json`. Nine B listings improved to A. Repairs include Canopy's actual Thu–Sun happy hour, current AGWA daily hours, a working Museum of Brisbane tour source and timing, AGSA's adult price/last-entry time, exact event dates and seasonal bounds. Source contradictions were not “fixed” by guessing: Cucina's Monday dinner conflicts with its contact-page closing time; Stella's stored promotion dates conflict with current seasonal copy. Both remain out of prominent recommendations. Broken historical event URLs remain flagged.

Source HTTP checks covered 126 unique URLs; 102 returned 200. A successful fetch alone did not update a verification timestamp. Some A listings concern daytime attractions, not dinner supply. The complete active-offer count is not a count of usable dinner deals.

## 3. Photos

Rights-cleared directory heroes increased **0 → 2**: Union Hotel (existing merchant-authorised exterior) and Adelaide Botanic Garden (Dinkum's 2010 CC0 image). Both are businesses with active offers. Of 33 active-offer businesses, **31 still lack a rights-cleared directory hero**; across the 309-business directory, 307 do. This is a limited, defensible start, not complete promoted-photo coverage.

Union: HTTP 200, decoded WebP, 1440×947, 320,054 bytes. Garden: HTTP 200, decoded JPEG, 1280×937, 533,830 bytes. Both visually checked at mobile width with cover crop and no stretching. The Garden caption discloses its 2010 date; it is not presented as recent venue photography. All 33 existing unique catalogue image URLs fetched and fully decoded; six expanded offer rows use the honest unavailable-photo fallback. One third-party header says `webp` rather than `image/webp`, although the actual bytes decode successfully.

Rights and provenance remain in merchant metadata. Garden licence: https://commons.wikimedia.org/wiki/File:Botanic_Garden_Adelaide_South_Australia.JPG . Existing offer artwork is not automatically authorised as a directory hero. No stock or generated venue photos were added. Existing image optimisation, lazy offer images and deferred maps remain; the two direct hero images are still 320KB/534KB and could be made lighter.

## 4. Map and business quality

Missing coordinates **84 → 77**; seven verified repairs, confirmed coordinates **225 → 232**. Initial missing-coordinate classifications: **A 7 / B 21 / C 56**. Here C means an incomplete or multi-place geocoding record, not proof the business is invalid or closed. Every B/C entry is listed with its reason in `data/consumer-missing-coordinates-2026-09-14.csv`.

Repairs: Borsa Pasta Cucina, Steampunk Surfers Paradise, The Waggon, The Best Brew Bar & Kitchen, The Boat Mindarie, Hurricane's Grill Circular Quay and Steersons Steakhouse. Exact official-site destination coordinates or structured venue coordinates were matched to their addresses. Website-agency coordinates, another franchise branch and map viewport centres were rejected. No suburb centroids, interstate substitutes, deletion or automatic duplicate merging. Sources and exact points are in `data/consumer-coordinate-repairs-2026-09-14.json`.

Adelaide map verification: 25 pins, 20 offer cards and 61 directory cards; offer-only filtering and actionable marker popups work. Nearby mode keeps distance ordering; normal directory results favour A/B active-offer businesses over incomplete empty profiles.

All 309 businesses have a visible-quality classification: **A 18 / B 124 / C 167**, with missing photos, offers, addresses, categories, website issues and possible duplicate identities recorded individually in `data/consumer-business-quality-2026-09-14.csv`. These are explicit rule-based review grades; closed status and suburb accuracy were not independently established for every business. No uncertain business was silently deleted. The 68 outreach suppressions and four do-not-contact merchants remain intact.

## 5. Three-business claim pilot

Ready for a **controlled real-owner pilot**, not a claim that the owner lifecycle has been proven. Production still has zero merchant claims and zero memberships. No invitations were sent.

Choose one independent pub/restaurant already carrying a strong offer (Union-type), one family dining venue with a public offer, and one independent venue with a basic profile but no offer (Borsa-type). Select actual authorised contacts and check suppression first. Examples describe suitable types, not permission to contact those businesses.

Owner instructions:

1. Open the venue profile, review the existing details and choose **Claim this business**.
2. Create an account/sign in with the owner's or authorised manager's real business email; complete email verification.
3. Confirm role, provide concise authority evidence and consent, then submit once. Known name, address, phone, website, category and current-offer count are prefilled/displayed; owners do not re-enter them.
4. Wait for PerkDrop review. Staff verifies authority before granting membership.
5. After approval, sign in and start with **Review listing/photos**, **Add/view offers**, or **Activity/bookings**. Advanced capacity and commercial controls are collapsed. Review existing public information before proposing edits; use only authorised photos. New offers still require review before publication.

Staff instructions: check the real person's verified email and role, compare the business domain/public phone and authoritative venue listing, seek a short confirmation through a known business channel if evidence is insufficient, record the decision, approve only the correct merchant/role, and have the owner demonstrate their new access. Verify listing editing, authorised image submission, draft offer creation, staff approval boundaries and activity visibility together. Do not create a fake owner to manufacture success. Review consumer corrections separately in the private portal queue.

Planning estimate, not measured: 5–10 minutes of owner input and 5–15 minutes of staff review per uncomplicated venue, plus waiting for email/authority confirmation. Likely friction: email verification/delivery, uncertainty about acceptable proof, already-published public information versus an unclaimed profile, and advanced legacy controls. Authenticated first-owner screen and approval/email delivery need the three real businesses to validate end-to-end; anonymous login/signup UI and database authority gates have been tested.

## 6. Trust and corrections

Public-source offer labels are distinct from business-approved offer terms, a business-verified profile, partner and exclusive status. Union can have approved offer terms while its directory profile is not yet claimed. Last checked derives from a stored source review; stale, unknown and conflicting states are explicit.

`/report` accepts a reason and optional short detail; no account or giant form. New private `listing_reports` queue has RLS and no anonymous/authenticated table access. The public endpoint uses input limits, a honeypot, a salted gateway-IP hash (no raw IP persistence), five reports/hour and atomic same-listing/reason deduplication. Staff queue read/review requires the verified PerkDrop owner account. Reports never automatically hide a venue, send email or change outreach status. Distributed abuse and shared-network rate limiting remain limitations; this is modest protection, not a full abuse platform.

The genuine observed Cucina hours contradiction was submitted through production UI at 09:59:32 UTC. Report `935d99c0-43b4-471d-8bb0-86e84c4b54f5` is **pending** for offer `PD-2026-0058`; both offer and business remain active. Anonymous queue access returns 401. Staff should review this real issue; it was not dismissed merely to tidy QA results. Authenticated staff queue rendering/status changes were not tested with a live owner login.

## 7. UX

Home leads with usable local offers, food and free activities; supply gates category chips. Radar is secondary “Deal alerts”; Saved & passes uses plain language, and device recovery is collapsed. Owner landing actions are obvious; advanced management stays available but lower. Search adds practical synonyms without AI: schnitty/schnitzel, cheap dinner, kids eat free, date night, free stuff, things to do, lunch, pub/pizza, family, Adelaide CBD and near me. Whole-word food matching prevents “eat” inside “great” turning a gallery into a food result. Search synonyms improve recall, not price guarantees or personalised recommendations.

## 8. Testing

- Production build and lint pass; four changed Edge Functions pass Deno type checking. The JS frontend has Next's build validation, not a newly introduced TypeScript conversion.
- 30 unit/contract checks: availability 9, discovery 7, inline portal/booking parsing 2, analytics 1, saves 2, social asset/publishing guards 9.
- 41 isolated real-Postgres checks, including four new consumer-report checks; all pass. This harness does not emulate the entire Supabase RLS/PostGIS/HTTP stack.
- Marketplace harness: 10 assertions. Route smoke: 34 expected HTTP outcomes, including intentional missing-deal 404s. Production dependency audit: zero vulnerabilities.
- Browser widths: 320, 360, 375, 390, 412, 430, 768, 1280. Home, search, Tonight, map, report, business profile, claim and Union booking page checked for overflow, zoom restrictions and overlays; no layout failures. Screenshots at 320/390/1280.
- Existing 17 browser journeys: preselection/prefill, sign-up tab, search/reselect, map pins/popup/offer filtering, denied-location manual fallback, city changes, case-insensitive search, no results, venue claim link, Union party size four without a booking/hold, My Perks, merchant/social auth and JS errors.
- New consumer journey: exact-time explanation, wrong-day/lunch exclusion, weekday selector, unsupported-market empty state, food-category false-positive prevention, four natural searches, both decoded/cropped business heroes, required report reason and private-queue denial.
- All 33 current unique catalogue images fetched and decoded; two promoted heroes separately fetched, decoded and visually inspected.

Post-deployment on `https://perkdrop.au`: all 64 route/viewport combinations passed (eight routes × eight widths), all 17 existing journeys and all 14 new consumer checks passed, plus all 34 route smoke outcomes. Save → readable Saved & passes link → Union page → remove passed, with the isolated QA save cleaned up. `/today` defaults correctly to today; homepage makes zero business-directory requests. The source-review tools did not turn HTTP success into verification. The data-quality skill kept incomplete evidence and no-delete classifications explicit.

Local verification artifacts: `.audit/browser-quality/perkdrop.au/` contains per-route JSON and 320/390/1280 screenshots; `journeys.json` and `save-journey.json` record browser assertions. `.audit/consumer/browser-perkdrop.au.json` records the new flow. These machine-local artifacts are not committed or public. Prominent screenshots: `_tonight-390.png`, `_tonight-1280.png`, `_claim_merchant_union_hotel_adelaide-390.png`, `_venues_union_hotel_adelaide-390.png`. Both hero crops also have separate `.audit/consumer/*-perkdrop.au.png` captures.

Report reproduction: `node scripts/build-consumer-review.mjs` uses the committed public-field-only dated input snapshot and explicit manual decisions. It regenerates CSVs and a reviewable local SQL patch; it never writes production. Raw website HTML, private contacts and credentials are excluded. The snapshot is historical, not a current re-verification. Never blindly replay the production evidence SQL over later owner edits.

## 9. Production

Schema migration `20260914094542_consumer_utility.sql` and the reviewed `supabase/release/consumer-evidence-20260914.sql` data patch were applied to existing project `khzpdyyywiucfhubxkev`. The local migration filename was aligned to the actual production ledger version, preventing a later CLI push from treating the same schema change as unapplied. No schema was reapplied during that filename alignment.

Deployed functions: catalogue API v21, business directory v8, portal v17, listing reports v1. Existing anonymous public APIs retain their prior JWT setting; the new public report submission is intentionally anonymous, with explicit server authentication on staff operations.

Implementation commit: `f50306ec16ebde8a86ddc1684fe68f4ace10cc0b`, pushed to `lukep1100/perkdrop` main. GitHub-triggered Vercel deployment `dpl_Di8E1QFPwHUcDfnyyKz1jFKcSt4X` reached **READY** and aliases `perkdrop.au` and `www.perkdrop.au`; deployed asset release is `v32-consumer-utility`. Inspection: https://vercel.com/lukep1100s-projects/perkdrop/Di8E1QFPwHUcDfnyyKz1jFKcSt4X . Post-release browser/HTTP checks above used the production custom domain, not just localhost. The final report update is a documentation-only follow-up commit.

Existing Supabase advisory remains: leaked-password protection is disabled; service-only tables intentionally have RLS with no public policies. No new public data access was granted. Buffer remains Vault-only and the previous invalid-slide social publishing guard remains untouched.

## 10. What still sucks

1. Dinner supply: one evidence-backed Adelaide option tonight is not a compelling market.
2. Photos: only two of 33 active-offer businesses have rights-cleared directory heroes.
3. Data completeness: 77 missing locations and 167 lower-quality directory records remain.
4. Freshness operations: evidence expires, but no real merchant network yet keeps hours and offers current; 19 offers remain C/D.
5. Owner proof: zero real claim completions means email, staff turnaround and first-owner use are not yet validated in the wild.

**NO.** If choosing dinner in Adelaide tonight, I would not check PerkDrop before Google, Facebook or EatClub. The results are more honest and usable, but one confirmed dinner offer gives too little choice. The next meaningful improvement is verified local supply and real business participation, not another feature.
