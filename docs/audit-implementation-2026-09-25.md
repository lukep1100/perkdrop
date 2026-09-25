# PerkDrop audit implementation — 25 September 2026

This release makes local discovery and a usable outing plan the main product journey. Standard business participation remains $0 setup and $0 monthly. It does not introduce a paid consumer tier.

## Delivered

- One shared, source-backed schedule model for web and native: dated events, occurrences, recurring hours, venue timezones, exclusions, explicit overnight service and admission cutoffs. A long exhibition envelope does not imply continuous opening. Unreviewed or stale facts fail closed.
- Corrected Regurgitator to **16 October, 8–9 pm Adelaide time**, from the organiser. Source/time/price changes invalidate prior schedule verification. The home this-week collection now applies a real date filter.
- Stable venue identity, preserved legacy paths and consolidated AGSA, Adelaide Botanic Garden and SA Museum cards. Distinct national branches keep their own coordinates and validated directions destination. At release verification these three venues contained 11, 3 and 3 current listings respectively, with one venue ID each.
- Default local search, an explicit Australia-wide choice, suburb/postcode lookup without GPS and nearby ordering. The underlying dataset contains approximate suburb centres, not precise venue geocoding. Searching Elizabeth offers Elizabeth SA 5112; selecting it retains that area and showed 21 places / 37 offers in the checked 25 km area. Those counts change with live supply.
- A more compact home introduction, visible local photography, essential date/price/address facts, readable dark map popups and venue-specific accessible pin names. Overlapping pins spread with connecting lines to the actual locations; no numeric clusters.
- Date, group-admission budget, child-age, indoor/outdoor and wheelchair filters. Age, setting and accessibility matches need affirmative evidence. Unknown prices are excluded from strict budgets. Conditional “kids free” offers are not presented as free family admission.
- Direct Add to plan, suggested dates, compatible nearby options, stop ordering, group-cost basis, source-backed service windows, private sharing/revocation, Google Maps routes and an ICS calendar export with a reminder. Maps supplies actual travel time; PerkDrop labels straight-line distances. This is an itinerary, not a reservation. Plans save atomically and retain selected national branches.
- Explicit single-use device pairing with ten-minute expiry, distinct revocable credentials and retained original-device access. This shares saves, plans and passes between app and browser. Separate pre-existing profiles are not merged. Email recovery remains unavailable.
- A simpler merchant form that first distinguishes external booking, information-only events and PerkDrop claims. Capacity/verifier fields apply to claims; external bookings and public events require an official HTTPS page. The publishing path accepts non-claim listings without invented capacity, uses matching customer actions and carries the approved media asset through to the public card. Times are interpreted in the selected Australian jurisdiction. Draft preview and final authority, accuracy, imagery and terms checks remain.
- Separate pseudonymous visitor and 30-minute visit IDs; owner/QA and preview traffic excluded from growth reporting. Added plan/share/calendar events, common native attribution and corrected outgoing catalogue-ID validation. An outbound click is not attendance or revenue.
- Useful server-rendered collection content; updated cache assets. Watchers query due sources, avoid duplicate pipeline work and back off repeated failures up to a day. Uncertain candidates retain review gates.
- Reconciled stale placeholder notes only where the existing current asset has licence evidence. Image-credit arrays select the evidence attached to the asset. This does not certify or replace every catalogue photograph.

## Release evidence

Website changes: [PR #16](https://github.com/lukep1100/perkdrop/pull/16) and the merchant publishing follow-up [PR #17](https://github.com/lukep1100/perkdrop/pull/17). Native continuation: [PR #14](https://github.com/lukep1100/perkdrop/pull/14).

- Web production builds and lint passed. The focused suite passed **27 checks**, including date/DST/overnight boundaries, price/age evidence, stable branches, calendar escaping, analytics contracts and watcher backoff.
- GitHub's isolated PostgreSQL integration suite passed **71 checks**, covering the five audit migrations, device-link concurrency/replay/revocation, private access, schedule invalidation atomic owner-scoped plan saves, non-claim publication and reviewed media projection. Local embedded PostgreSQL could not run under this workspace's root-only UID mapping; the cloud database checks supplied that gate.
- All nine changed Edge Functions passed Deno type checking. Production deployments: catalogue v42, marketplace v6, merchant-submit v10, track v9, nav v4, go v7, owner-analytics v7, regular event-watch v3 and profiled event-watch v4. Existing JWT/custom-auth requirements were retained.
- Browser verification exercised the corrected concert, selected-area search, grouped gallery, popup contrast, a two-stop saved/reordered outing, calendar button, private sharing and revoked-link rejection. A second browser identity connected through a single-use link and displayed the same private outing.
- Native Expo Doctor passed **21/21**. iOS and Android bundles exported successfully. The native PR's build, database, Edge and mobile checks passed after the shared release integration. This is source/build evidence, not physical-device certification.

## Work that needs external inputs or continuing operations

1. **Email and push:** the production email transport is disabled with no sender configured. Do not advertise email recovery/digests or remote push until sender/domain delivery, consent, opt-out and device tests pass. Calendar reminders already work through the user's calendar application.
2. **Store release:** Apple payment/signing and the existing Google Play account prerequisites remain unresolved. No store gate was bypassed. The old internal Android APK does not establish parity with this revision. A newly signed binary, real installs, deep-link tests, permission denial, offline recovery and genuine screenshots are required.
3. **Supply and imagery:** software cannot manufacture contracted perks or photo permission. Prioritise the queue below; obtain evidence and authorised imagery before promoting each listing. No merchant outreach or messages were sent in this implementation.
4. **Measured growth:** real-device performance, 7/28-day retention and partner outcomes need observation after release. No uplift percentage is claimed. Internal traffic exclusion starts with this instrumentation; old unlabeled events cannot be reliably reclassified.
5. **Further planning:** live travel-time integration, automatic conflict-free reservations, group voting, paid benefits and remote reminder delivery are later additions. The current planner gives reviewed hours and honest unknowns, with actual travel times available through Maps.

## Operating queue and acceptance

| Priority | Work | Owner role | Evidence needed to close |
|---|---|---|---|
| P0 | Recheck promoted times/prices when source changes | Catalogue editor | Dated official evidence, venue timezone, valid periods/exclusions, fresh verification |
| P1 | Elizabeth/northern suburbs: family free or low-cost options | Supply/editorial | 3–5 worthwhile options per priority date/use case, child ages, total admission basis and actual meeting point |
| P1 | Adelaide beauty/wellness and other empty promoted categories | Partnerships/editorial | Approved useful perks or public offers; no invented exclusivity or capacity |
| P1 | Featured real photos | Media reviewer | Per-asset source, author, licence/permission, credit, event-vs-venue purpose; no AI factual imagery |
| P1 | Repeated 403 monitoring responses | Operations | Use permitted official feeds/pages or human review; do not bypass access controls; confirm next-check backoff |
| P1 | 128 needs-review / 12 new / 5 approved audit backlog | Catalogue editor | Recheck each candidate; publish useful eligible records, retain reasons for holds and expiry |
| P1 | App device QA | Release owner | iPhone and Android: install, location denial, manual area, date filters, saved access, pairing/revocation, plan return, network loss |
| P2 | Merchant distribution kit | Partnerships | Approved listing URL/QR and authorised artwork, accurate benefit/conditions, source attribution; review before sending |
| P2 | Delivery readiness | Operations | Configured sender, real consent/opt-out tests, reliable delivery/deep links; store/device credentials for native push |

The backlog numbers are the audit snapshot, not a claim that each candidate was verified. Watcher failure counts are repeated occurrences, not distinct broken sites. Review remaining RLS/password-advisor notices against intended access without loosening policies or purchasing an upgrade automatically.

## Measurement definitions

| Measure | Definition and guardrail |
|---|---|
| Useful discovery | Public visit with save, plan, directions or official-link action / public discovery visits; report each action separately |
| Speed to choice | Time from first discovery view in the visit to first meaningful action; exclude incomplete visits from the median and show their share |
| Local coverage | Verified usable choices by selected area, date, category and price basis; deduplicate venue and occurrence |
| Trust | Validated wrong-time/price/location or ended-offer reports; include denominator of viewed listings |
| Return use | Pseudonymous visitors returning in 7/28 days, excluding internal traffic; browser/install identity is not a person |
| Plan utility | Created/shared/revisited plans and calendar exports; edits do not emit a new-plan event; browser analytics remain an action measure, not an audited database count |
| Partner outcomes | Attributed interest, confirmed redemptions and verified provider confirmations separately; never convert clicks into sales |
| Discovery efficiency | Verified useful publications/corrections per run, fresh-source coverage and review age; report repeated source failures separately |
