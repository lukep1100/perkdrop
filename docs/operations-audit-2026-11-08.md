# PerkDrop operations audit — 8 November 2026

Apple's two App Store Connect emails confirmed approval at 10:16–10:17am Adelaide time on 3 November. Following explicit release authorisation, the manual Australia-only release for app ID `6820120968`, version 1.0, approved build 11 was accepted on 8 November. Authenticated App Store Connect shows **Ready for Distribution**. This supersedes the initial Pending Developer Release snapshot. The Australian public lookup still returned zero results at verification, so public download availability is not established. Apple Analytics was unavailable; there are no verified App Store download figures to report.

Production repair PR #26 was merged as `1116041bd933ac70922220d0f1f6a94ec5b2553b`. Vercel deployment `dpl_HtvmSc3BT7PUuKaBtCAKtudyHX24` reached Ready with `perkdrop.au` and `www.perkdrop.au` aliases. The live JavaScript checksum matched the tested source, production HTTP smoke checks passed, and no errors appeared in the checked recent runtime window.

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

The build and npm audit identified critical/high runtime dependency advisories. Next.js was patched from 16.4.0 to 16.4.5 and compatible transitive updates were applied. Follow-up maintenance uses Capacitor CLI 8.6.0 and maintained ESLint 9.39.5; the complete npm audit now reports zero vulnerabilities, including development dependencies. ESLint 10's minimatch dependency remained affected, so the compatible maintained 9.x line is pinned instead of forcing an incompatible transitive major. Capacitor runtime/iOS packages and the approved native binary are unchanged. Lint, build and native configuration tests pass; Linux cannot run Xcode device/archive verification.

## Closeout maintenance

The master brief now reflects the controlling 15 September decision: free standard merchant participation, $0 setup/$0 monthly and no standard per-person/redemption/card fee. Its release and measurement notes and both daily Operations/Pulse prompts now reflect the verified release and production repairs. Sharing and schedules are preserved.

Migration `20261108040558_event_watch_stalled_run_guard.sql` extends the existing hourly maintenance without changing its candidate-expiry or repeated-dead-source rules. Only empty v3 runs older than two hours and empty national editorial v5 runs older than 24 hours are marked stalled. Progress counters, recent runs and unknown job types are protected. The outcome is explicitly unknown, failures increment once, and original details are retained. The private health view excludes stalled/running/failed records when reporting the latest completed run. Function privileges remain restricted to the existing maintenance owner; no new public API is exposed. Regression checks cover thresholds, protected work, idempotence, existing expiry/source rules, health freshness and private execution.

Remaining limitations: source access failures (403/404/timeouts), placeholder-heavy imagery, unresolved candidates and unconfirmed merchant offers remain distinct catalogue-quality work. Do not bypass source access controls or invent image rights, business approval, downloads or attendance. The La Moka reply remains an unsent draft; no emails or social posts were sent. Further outreach requires explicit sending authorisation.
