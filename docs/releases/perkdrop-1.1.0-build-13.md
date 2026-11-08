# PerkDrop 1.1.0 / build 13 — easier discovery

Recorded 8 November 2026. This is a TestFlight candidate replacing build 12 for the same unreleased version 1.1.0. The public App Store release remains 1.0/build 11. Device acceptance and refreshed native store screenshots are still outstanding.

## Source and production web

- PR #32: https://github.com/lukep1100/perkdrop/pull/32. Final reviewed head `8a4c8616b6d27e8b3f16b0efa8abc0ca2d5a1d61`; merged runtime `2333f704147bfa7b0519914917eb69b4cd9ff566`.
- Production deployment `dpl_EM4qHRdoqb9c72XFPBLMV3bBsybe`, READY on the intended PerkDrop Vercel project and team. Live asset version `v52-easy-discovery`.
- Production home, app module, shared action module and health returned HTTP 200. Browser inspection confirmed the compact offer feed and the source action with existing internal-traffic attribution. No runtime error/fatal records were returned for this deployment in the query through 07:36 UTC.
- No database, merchant participation, ingestion schedule or event-publication gates changed in this release.
- A follow-up web correction uses `v53-easy-actions`: booking-required inventory uses the single external booking action rather than also rendering a separate capacity panel. Native build 13 is unchanged by this web/documentation follow-up. Lint, the production web build and 13 focused action/embedded-browser checks passed.

## User-facing changes

Offers appear immediately after compact search and quick choices. Native distance/date/category/family controls share one draft/apply sheet with a real unique-place count. Close discards edits. Map radius controls stay visible. Venue cards present one primary offer; exact-branch alternatives are available in detail. Detail keeps one primary action visible, distinguishes source links and bookings from genuine pass inventory, and resets scrolling when another offer is selected. Photo attribution controls remain independent of the card tap. Web follows the same compact hierarchy and preserves filters when opening the map.

Research scope and next commercial priorities: [EatClub study](../product/eatclub-ux-study-2026-11-08.md). Public browser flows and published app instructions were studied; no signed-in competitor native app or payment was tested.

## Validation

172 focused native/shared/web tests passed locally, alongside lint, the production web build and Expo web export. All five final PR workflows passed: CI/Edge, marketplace integration, Expo mobile checks, iOS native preflight and real-iPhone-architecture archive verification. The release archive workflow was `42458948153`, job `128663958721`.

390-pixel browser QA checked early offer visibility, exact draft/apply counts (six Food places at 10 km in the checked Adelaide feed), cancelled edits preserving the previous area and results, source/conditions presentation and explicit quiet-area widening. This is browser rendering, not a physical iPhone test.

## Signed distribution and final acceptance

Signed upload workflow: `42459319761`, job `128664988801`, from the merged source above. The workflow completed successfully. Apple build ID `553ec4bd-05f0-4519-9c68-eb236bfcf5fe` was processed VALID; App Store Connect confirms Binary State Validated. Build 13 is assigned to the existing PerkDrop Internal Test group (one existing tester), with a real-device checklist saved in What to Test. App Store version 1.1.0 now has build 13 attached with revised release notes and reviewer instructions. Apple completeness checks passed and the version is in a Ready for Review draft. Automatically release after approval remains selected. **Submit for Review has not been pressed.**

Before public submission: install build 13 through the existing internal TestFlight group; check manual area and denied location, 1 km empty-area recovery, explicit widening, map/list filter continuity, filter Apply/Close and counts, offer/source/directions return, exact-place alternatives, save/unsave/restart, larger text/keyboard scrolling and optional notifications. Capture current native screenshots or a short recording. No device acceptance or App Review approval is implied by successful compilation or Apple processing.
