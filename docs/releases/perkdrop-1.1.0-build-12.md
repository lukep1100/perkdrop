# PerkDrop 1.1.0 / build 12 — release evidence

**Historical record:** build 12 was superseded later on 8 November by [build 13](perkdrop-1.1.0-build-13.md). Use that record for the latest TestFlight candidate and draft submission.

Recorded 8 November 2026. The public App Store version remains 1.0/build 11. Version 1.1.0 is a processed TestFlight candidate and a **Ready for Review draft**, not a submitted or approved public update.

## Shipped web and services

- Runtime changes: PR #29, merged `dc5986d15a0745c92802e2a3a48860610f2ca067`. Adds checked quick plans, recommendation explanations, saved-category interest continuity, consistent category/date map filters, local-feed error recovery and a reviewed release manifest.
- Follow-up: PR #30, merged `6c9895a934670e3771de1519123259cd10012101`. Improves official event-link discovery and aligns draft store copy. No native runtime changes.
- Production `https://perkdrop.au` uses `v51-smart-plans`; Vercel deployment `dpl_Fi6z9yLjSbbpvZQhvNcz4HmaNnMn` was READY. Browse/search/map/category/health probes returned HTTP 200. No runtime errors were found in the checked post-release 15-minute window.
- Supabase catalogue v48 and nearby v8 remain live. Event watcher v10 preserves the prior worker, cadence, authentication, source trust and publication gates, replacing only the tested link-discovery module.
- Added the official City of Playford library-program and events indexes to monitoring. Both were checked by the scheduled worker at 06:50 UTC with HTTP 200 and zero failures. This is monitoring evidence, not a claim that new events were published.

## Signed iPhone candidate

- Native source: `dc5986d15a0745c92802e2a3a48860610f2ca067`.
- GitHub signing/upload run: `42455475224`, job `128653432142`; completed successfully.
- Signed identity: `au.perkdrop.app`, version `1.1.0`, build `12`. Production APNs and `applinks:perkdrop.au` were verified; opt-in consent remains required.
- Apple build ID: `7dbc7146-e4a1-46ec-a4fe-01eacbe96254`. Apple processing confirmed VALID; App Store Connect shows Binary State Validated, iPhone arm64, minimum iOS 16.4 and no non-exempt encryption.
- Build 12 is assigned to the existing PerkDrop Internal Test group (one existing tester), with an acceptance checklist in What to Test.
- App Store version 1.1.0 has build 12 attached, updated description/release copy/reviewer notes, and automatic release after approval selected. It is added to a draft submission only. **Submit for Review has not been pressed.**

## Validation and remaining acceptance

All five PR #29 and #30 workflows passed, including Expo doctor/export, iOS preflight/archive, backend checks and marketplace integration. 116 native/shared checks passed locally; the event-ingestion/store-copy follow-up passed 21 focused checks. Browser testing verified empty-circle recovery, explicit widening, plan preservation across nationwide browsing, matched plan counts/results, responsive web layout and native Explore browser rendering. Browser rendering is not a physical iPhone test.

Before submitting the public update, install 1.1.0 (12) in TestFlight and check: Craigmore/5114 at 1 km and explicit widening; map circle versus results; free/tonight/weekend plans; save/unsave and restart; source/directions return; keyboard/scrolling/larger text; and optional location handling. Capture current native screenshots/a short recording for refreshed App Store assets. Do not claim device acceptance, current screenshots, App Review submission or approval until observed.

The JSON under mobile/store remains a draft preparation template; this release record and the current App Store Connect state hold the actual signing and submission evidence. The signed workflow runs only when an explicit mobile/release.json change reaches main, or is manually dispatched. Normal catalogue, web and documentation updates do not upload another binary.
