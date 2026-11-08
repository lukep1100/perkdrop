# PerkDrop operations audit — 8 November 2026

Apple's two App Store Connect emails confirmed approval at 10:16–10:17am Adelaide time on 3 November. Authenticated App Store Connect inspection confirmed app ID `6820120968`, version 1.0, approved build 11, and **Pending Developer Release**. Manual release was selected. The final Australia-only release confirmation was prepared, but automatic approval review rejected publishing because the current audit request did not explicitly authorise that action. No release was performed. Apple Analytics reports this app currently unavailable for analytics; there are no verified App Store download figures to report.

## Performance correction

Known crawlers were following official-link and directions redirects, inflating customer engagement. Googlebot accounted for most recent recorded outbound actions. Raw history is preserved. Shared `analytics-traffic.mjs` now excludes positively identified automation at the tracking endpoint and redirect handlers and filters historical bot rows in owner analytics. Robot redirects remain usable. The previously deployed tracking privacy protections (path-only paths and origin-only referrers) are preserved in source.

Complete Adelaide-local weeks, excluding marked internal traffic and known automated user agents:

| Metric | 25–31 October | 1–7 November |
| --- | ---: | ---: |
| Distinct tracked session IDs | 14 | 14 |
| Page views | 16 | 25 |
| Deal views | 2 | 8 |
| Official-link clicks | 0 | 1 |
| Excluded automated events | 451 | 774 |

These are anonymous recorded sessions/actions, not verified people, installs or attendees. Unmarked owner/QA browser activity can remain. No proven redemption occurred in these periods; the historical redemption table contains an expired September claim, not evidence of attendance. Daily operations and pulse instructions now use this distinction and bot exclusion.

## Operations

- Production HTTP smoke checks passed across the site's main routes, support/privacy/deletion pages, health, manifest and service worker. Missing detail links correctly return 404.
- No active row was past its current end timestamp or applicable venue-local end date at verification.
- The 21 October production migration intentionally configured the main watcher dispatcher every five minutes, with per-source scheduling, and the profiled watcher hourly at :23. Older reports describing this as unauthorised cadence are superseded by that implementation.
- A historical `expired_at` on an active recurring event can describe an earlier occurrence. Use current lifecycle and occurrence times when assessing expiry.
- Forty empty v3 runs open for over two hours were explicitly marked stalled, with audit closure time and unknown side effects. They must not be presented as successful discovery.
- Missing operational suppression entries were added for Mugen House, Café 228 and the bounced Finestfashionz address, backed by the original emails. Existing removed merchant records remain removed.
- La Moka's 24 October inbound follow-up still needs attention. Rub Massage received a follow-up on 26 October without a subsequent reply in the checked thread. No messages were sent in this audit.
- Live browser checks confirmed Home, Map and save/remove persistence. A malformed Gamers175 link exposed absolute first-party URLs stored in `detail_url`: 19 exact matching rows were normalised to `/deals/{slug}`. Consumer routing now accepts canonical first-party absolute detail URLs and rejects external destinations, preventing recurrence when an importer stores a full URL. A La Moka follow-up was saved as an unsent draft.
- Detail lookup also scanned only the first 1,000 catalogue rows and enriched only the first 500 active rows before matching a requested slug. Newer valid events could therefore return 404 despite being visible in discovery. The live catalogue endpoint now looks up bounded slug/prefix candidates directly and scopes detail enrichment to those IDs, preserving all visibility, accuracy and expiry guards and the 500-item browsing ceiling. The existing live evidence-expiry safeguards were preserved and brought into source.

## Verification

60 focused analytics, discovery, expiry, availability, routing and event-ingestion tests passed, along with lint, production build and App Store support-page checks. Tests execute tracking, official-link, claim-link and directions handlers with mocked storage: known bots cause no writes, normal browser actions retain tracking, and redirects remain correct. Live probes returned 202/ignored for a crawler, 202 for an explicitly internal test, and the expected official and Maps redirects. Database verification found the one internal probe and no bot probe row. Owner analytics still rejects unauthenticated requests. The repaired Gamers175 and Burnie detail API/public pages return 200; the expired Home Hill event returns 410; unknown slugs return 404. Local Deno type checking could not fetch the JSR package manifest; the initial review commit's CI, marketplace integration and native preflight passed, and CI retains the edge check.

The build and npm audit identified critical/high runtime dependency advisories. Next.js was patched from 16.4.0 to 16.4.5 and compatible transitive updates were applied. The rebuilt production dependency audit reports zero vulnerabilities. Six moderate development-tool advisories remain around ESLint/minimatch and Capacitor CLI/xcode/uuid; no forced major tooling change was applied to the approved native release.

Remaining limitations: source access failures (403/404/timeouts), placeholder-heavy imagery, unresolved candidates and unconfirmed merchant offers remain distinct catalogue-quality work. No new images, commercial terms, social posts or email sends were authorised by this audit's evidence.
