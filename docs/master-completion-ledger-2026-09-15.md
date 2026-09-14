# PerkDrop master completion ledger

Snapshot: 15 September 2026 current-state readback; deployment IDs are recorded with their matching source commits below.

This is an evidence ledger, not a launch certificate. `VERIFIED` means the stated acceptance check passed in the named environment. A blocked or untested participant/provider requirement remains non-green.

| Area | Status | Evidence / acceptance state | Remaining dependency |
|---|---|---|---|
| Auth site URL and callback handling | VERIFIED / NEEDS LIVE OWNER TEST | `/claim` and the four supported same-site redirect forms are implemented; `claimRedirect()` preserves a validated merchant slug and recovery flag. Live portal redirects for Union, A Bite to Eat and Adelaide Zoo preserve their slugs; empty, traversal and external-looking values resolve to plain `/claim`. | A real verification/recovery message and link-use journey still needs owner-approved QA recipient and inbox confirmation. |
| Auth transport | EXTERNALLY BLOCKED | Production configuration was read as default Supabase mail with custom SMTP disabled. | Owner must approve/establish the production sender/transport; no password, token or secret in chat. |
| Approval notifications | EXTERNALLY BLOCKED | `merchant_notification_config` is disabled, `provider=resend`, `from_email` is unset; queue/release gates remain closed. | Owner-controlled non-admin recipient, sender/domain, exact test messages and transport approval. |
| Business claiming / owner access | NEEDS LIVE OWNER TEST | Claim, role, consent, authority-evidence, competing-owner and pending-state gates are implemented and isolated concurrency-tested. | A real authorised business representative must submit, be reviewed and use the resulting access. |
| Public UX / PWA | VERIFIED | Production route smoke and prior responsive/browser evidence cover public discovery, saved items, policy/contact pages, PWA manifest/service worker and no-account browsing. | Full real-device Safari/Android pass remains untested. |
| Search, location, list/map agreement | VERIFIED WITH DATA GAPS | Shared filters, manual location fallback, directory/offer distinction, coordinate validation and co-located marker grouping are deployed. | 81 current non-removed merchant rows have missing coordinates; ambiguous rows require evidence, not guessed pins. |
| National discovery | VERIFIED ENGINEERING PATH | Service-auth trigger, official-site verification, candidate-only/unclaimed seeding and canonical vertical taxonomy are deployed. | More verified supply requires authoritative sources and/or participating businesses; no unapproved bulk seed run. |
| Photos / genuine-photo rights | NEEDS WORK | Rights gates, provenance fields, neutral fallback and decoding checks are deployed; existing verified heroes are limited. | Real authorised venue photography and rights evidence are still missing for most businesses. |
| Offer data / availability / expiry | VERIFIED SAFEGUARDS | Canonical vertical/inventory contracts, Australian-timezone service windows, expiry filtering and hourly expiry job are deployed; production cron readback shows the hourly expiry job, minute booking reconciliation, and 15-minute session closure all active with recent successful runs. | Current live catalogue uses multiple source tables; ongoing source freshness and conflicting terms still need operations. |
| Bookings / capacity / redemption | VERIFIED ISOLATED; NOT LIVE-OWNER VERIFIED | Atomic capacity, retry and redemption safeguards have isolated database coverage; no live booking or redemption was made for QA. | Controlled real-owner/consumer pilot is required for end-to-end confirmation. |
| Opt-out / delisting / reimport | VERIFIED ISOLATED | Normalized suppression, policy-based reversible delisting, exclusion ledger and import guards are deployed and tested without sending outreach. | External/manual senders still need independent pre-send eligibility checks. |
| Security / RLS / roles | VERIFIED ENGINEERING CHECKS | Service-only tables, role-aware responses, claim/invite authorization, upload rights checks and Vault-only Buffer access are deployed. | Supabase leaked-password protection remains an advisory item requiring owner policy decision. |
| Analytics / SEO / metadata | VERIFIED ENGINEERING CHECKS | Tracked-value-only analytics, deduplicated events, metadata/sitemap behavior, canonical links and PWA assets are deployed. | No claim of complete ranking, attribution or production-scale performance. |
| Catalogue reliability | VERIFIED MITIGATION / UNRESOLVED DIAGNOSIS | `/api/health` and direct catalogue health returned 200; a 20-request concurrent health burst returned 20/20 `200` responses, each reporting 52 rows with unique request IDs; six concurrent catalogue reads also returned 200/52 rows; `catalogue_api_failures` remains at 0 rows after the burst. Unknown and invalid detail slugs now take a bounded preflight and return 404 without the six-query enrichment fan-out; valid and multi-location slugs retain the existing safeguards. Nearby API v4 now rejects missing/non-Australian coordinates with a truthful 400, correlates requests, retries transient RPC/catalogue failures once, persists sanitized failure diagnostics and returns truthful 503s. | Historical 500/503 root cause is not proven; Vercel Hobby retention leaves insufficient surrounding traces. |
| Social publishing | BLOCKED / LOCKED | Job `461112dc-4de4-4157-b3a0-770749f65959` remains `verification_failed`; slide 04 fails complete-PNG validation; Buffer publishing is disabled and no draft exists. | Reattach the exact intact five originals, then owner review/approval. No schedule or publish action is permitted. |
| Native app | NOT APPLICABLE | The brief requires preserving the existing PWA and does not authorize a new iOS/Android/store app. | None unless product scope changes explicitly. |

## Current production counts

- Supabase project: DueMate → PerkDrop, reference `khzpdyyywiucfhubxkev`, status `ACTIVE_HEALTHY`.
- Supabase query: 320 merchants total, 6 policy-removed, 314 non-removed; 81 non-removed rows without plausible stored coordinates; 0 catalogue failure-ledger rows.
- Public `/api/health`: 52 live catalogue rows reported by the deployed aggregator.
- Raw `catalogue_items`: 78 total, 45 active/public-date-eligible rows, 33 inactive historical rows; public API expands active multi-location rows and excludes expired rows.
- Active `catalogue_locations`: 20. Direct catalogue health reports 45 live rows and 320 merchants; the public aggregator reports 52 rows after location expansion.

## Latest implementation and release evidence

- `bf89955` — add resilient share-link copy fallback for browsers without Web Share support; pushed and deployed.
- `7a20f36` — complete public merchant taxonomy options; pushed and deployed.
- `a0eda29` — expose complete canonical inventory units in the merchant editor; pushed to `origin/main`.
- `5161cff` — make merchant quick drops taxonomy-aware; pushed and deployed.
- `619ea14` — report tracked merchant value only; pushed and deployed.
- `3d4e5be` — short-circuit unknown catalogue slugs and add direct preflight regression checks; Supabase `perkdrop-catalogue-api` v35 ACTIVE, Vercel `dpl_2SpyjuqgDpMkFvxVQHPt6NGWvie3` READY.
- `f020749` — record the 20-request concurrent health-burst verification; Vercel `dpl_E4xMDwYy5FvHBhLZgP7FmTYeodBa` READY and aliased to the production domains.
- `a59a55f` — expose the sanitized upstream catalogue request ID and query diagnostics through `/api/health`; Vercel `dpl_D54fg8tvysviQzjn91Wjy2aQJwPq` READY and aliased to the production domains.
- `17f6c94` — assert the health correlation contract in production smoke; Vercel `dpl_8YmLc7pFC23aTGS4yxv5jPby31Ao` READY and aliased to the production domains.
- `dd0a8a6` — harden nearby catalogue dependency failures; Supabase `perkdrop-nearby-api` v2 ACTIVE and Vercel auto-deployment `dpl_GGiPNpNXEa1VL4CvJnfzhsv2bwGo` READY from `main`.
- Follow-up deployed Supabase `perkdrop-nearby-api` v4 to retry thrown catalogue-fetch failures as well as HTTP 5xx responses and persist sanitized dependency failures to the service-only ledger; live probes retained the same 200 valid-coordinate and 400 invalid-coordinate contract (ledger remains 0 rows).
- `39c6edf` — deploy Supabase `perkdrop-admin-commercial` v13 with a rights-confirmed image gate for its legacy `offer_publish` path; Vercel `dpl_AaJinCK7J1rCD8psHhrC854KBAqT` READY.
- `18bcd05` — record the nearby v4 failure-ledger persistence; Vercel `dpl_7JvWsuzhtSy5ahquDq4DNpKArQuX` READY.
- `d8f8930` — forward the Vercel health request ID to the catalogue dependency and preserve diagnostics on malformed upstream JSON; Vercel `dpl_DPN7ZwaZnBdSb76WdP62Ajch1zj8` READY and aliased to production.
- Supabase `perkdrop-admin-commercial` v13 now requires rights-confirmed offer media or a licensed/merchant-authorised hero before its legacy `offer_publish` path can create a public catalogue row; unauthenticated production access remains `401`.
- Supabase `perkdrop-nearby-api` v4 is ACTIVE (`verify_jwt=false`, preserving its existing public contract) with Australian coordinate validation, request correlation, bounded transient retries, sanitized failure diagnostics and service-only failure-ledger persistence.
- Supabase migration `20260914181858_catalogue_failure_ledger` is now registered and applied idempotently; the failure ledger retains RLS and service-role-only grants.
- Supabase `perkdrop-portal` v21 is ACTIVE with `verify_jwt=false`, matching the existing portal contract.
- Vercel production deployment `dpl_6stEpySDuFxadqQSP5ovWuJiKWV4` (source `4cd1a20`) is READY and aliased to `perkdrop.au` / `www.perkdrop.au`.
- Integrated local suites: marketplace 10, discovery/notification 16, availability 12, inline scripts 2, analytics 2, saves 2, database 60; production smoke passed when run with `SMOKE_BASE_URL=https://perkdrop.au` (the package-level smoke invocation without that variable is intentionally non-production and returns connection failures).

## Current read-only production configuration

- Supabase Auth provider page shows signups enabled, email confirmation required, email provider enabled, anonymous sign-ins disabled, and no third-party/custom providers enabled.
- Supabase Auth URL configuration shows site URL `https://perkdrop.au` and exactly four redirect URLs: the plain claim path, Union preselection, recovery, and Union recovery preselection.
- Auth template page shows default Supabase templates are in use; editing is gated until custom SMTP is configured. SMTP page shows custom SMTP disabled.
- Supabase Attack Protection shows leaked-password protection disabled as an owner policy decision; it was not changed during this run.
- Supabase retained unified logs currently return no rows for the selected recent window; the historical incident remains insufficiently correlated for a definitive root cause.

## Tests recorded

- `npm run lint -- --no-cache` — passed.
- `npm run build` — passed.
- `npm run test:inline-scripts` — 2/2 passed.
- Full `npm test` rerun after the registered failure-ledger migration: marketplace harness 10, discovery/notification 16, availability 12, inline scripts 2, analytics 2, saves 2, real database 60, and production smoke all passed; expected 200/404 outcomes and health-correlation assertion included.
- Live checks after the latest release: `/claim` 200 with canonical controls; `/api/health` 200; direct catalogue health 200; six concurrent catalogue reads 200; current Vercel runtime errors in the selected 15-minute window: none.
- Additional live reliability check: 20 concurrent `/api/health` requests returned 20/20 `200` responses, all reported 52 live rows, and all carried distinct `X-PerkDrop-Request-Id` values; the failure ledger remained empty afterward.
- Nearby production probes: Adelaide coordinates returned `200` with three deals and `X-PerkDrop-Request-Id`; missing coordinates and `(0,0)` both returned `400 valid_australian_lat_lng_required` with correlation IDs. No writes, bookings or notifications were triggered.
- Latest health correlation probe: production `/api/health` returned `200` with 52 live rows, and its wrapper request ID matched the upstream catalogue request ID exactly.
- Production scheduler readback: expiry job (`17 * * * *`), booking reconciliation (`* * * * *`) and session closure (`*/15 * * * *`) are active; their latest runs succeeded at 2026-09-14 18:17, 18:23 and 18:15 UTC respectively. Notification dispatch and five-minute matching also showed successful latest runs; no notification release was enabled.

## Owner action bundle

1. Approve a legitimate Auth/application sender and owner-controlled non-admin QA inbox, plus the exact verification, recovery and clearly labelled approval-transport messages; provide credentials only through the provider/Vault workflow, never chat.
2. Supply the intact exact five social PNG originals, including a valid replacement for the truncated fourth file; do not approve the existing failed job.
3. Nominate a real authorised business representative for the first supervised claim and first-access pilot.
4. For definitive catalogue 503 diagnosis, retain/export correlated Vercel/Supabase traces around a fresh reproducible failure or enable an appropriate log-retention window.

No owner action above has been performed by this job.
