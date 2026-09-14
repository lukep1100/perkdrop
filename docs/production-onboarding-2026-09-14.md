# Production onboarding continuation — 14 September 2026

Narrow continuation from main/prod d0483687b16d4d2e7d640da516f88e293cc3970e. No broad redesign, outbound email, social publication, paid activity, claim, membership, booking or capacity hold.

## Email: evidenced state, not a delivery claim

- Production public Auth settings return 200: email enabled, signup enabled, mailer_autoconfirm false. Verification remains mandatory.
- Signup verification, resend and recovery use Supabase Auth. A connected Gmail inbox is not an Auth sender.
- The authorised Supabase dashboard session is now `lukep1100` with access to DueMate → PerkDrop (`khzpdyyywiucfhubxkev`). Auth configuration was read in the dashboard without exposing secrets.
- Required documented read: GET /v1/projects/{ref}/config/auth, with auth:read (OAuth) or auth_config_read (fine-grained permission). Use the existing authorised account/secure normal login flow, never paste secrets in chat.
- Current Auth URL configuration: site URL is `https://perkdrop.au`; exact redirect allow-list is `/claim`, `/claim?merchant=union-hotel-adelaide`, `/claim?recovery=1`, and `/claim?merchant=union-hotel-adelaide&recovery=1`. Custom SMTP is disabled, so Supabase default Auth transport/templates are active; custom template editing is unavailable until SMTP is enabled. Provider sender/domain and delivery logs remain unverified.
- Intended claim approval provider: Resend API. enabled=false, sender absent, dispatch secret present (not displayed); Edge RESEND_API_KEY presence remains unverified. No matching mail-provider Vault secret names were present, which does not establish Edge environment-secret absence.
- Both merchant and consumer notification backlogs were empty. Production merchant claims and memberships were zero before/after repairs.
- Highest production delivery stage for all three paths: **not tested / no message sent in this task**. No recipient or exact-message approval received. No actual inbox receipt, provider delivery event or link use evidenced.

## Applied technical repairs

## Master checkpoint — current continuation

- The requested `PerkDrop_Mission_Pack/START_HERE.txt` was not present in the checked-out workspace or available attachment directories, so the repository's existing audit and execution evidence were used as the authoritative fallback. No supplied discovery component was integrated without its source.
- Current authorised write path is confirmed: GitHub `main` push and the connected Supabase deployment connector both succeeded for this continuation.

- Auth callback verification: production `/claim` remained same-site for Union, A Bite to Eat and Adelaide Zoo; missing/invalid slugs stayed on the search flow; an injected external `returnTo` was not reflected. The deployed portal constructs redirects from the fixed `https://perkdrop.au/claim` origin and a validated merchant slug. No email journey was exercised.
- Catalogue reliability: added sanitised request correlation, upstream status/timing logging and `X-PerkDrop-Request-Id` response headers to `/api/health`, `/sitemap.xml` and dynamic catalogue pages. Existing 503 semantics and honest fallback responses remain unchanged; no fake data or blanket 200s were introduced. The first post-deploy probe captured the previously hidden failure shape: the catalogue dependency returned HTTP 500 after about 5.2 seconds; the underlying Edge-query error still requires Supabase function logs or a recurrence with the new query labels.
- Verification: `npm run lint -- --no-cache` and `npm run build` pass locally. Production deployment `dpl_9gKdoxEZtMzXJ8NS3ruisdgRLStF` is READY; post-deploy `/api/health` returned 200 with a correlation header, direct catalogue returned 200 with an upstream request ID, and no new Vercel `catalogue_dependency` errors appeared after the patch. The historical 503 is mitigated diagnostically, not closed as resolved.
- Existing national discovery worker reviewed: it requires official website evidence, real coordinates, deduplication and candidate-only image rights; it does not auto-authorise photography or fabricate offers. No new national seed run was launched because that would create production directory records without a supplied mission-pack component or owner review requirement.
- Native-app/PWA readiness: global manifest, standalone metadata, theme/status-bar metadata and service-worker assets are now present on every rendered page. Production `/`, `/manifest.webmanifest` and `/sw.js` returned 200 after deployment; no app-store account or duplicate application was created.
- Reliability follow-up: five sequential production health probes all returned 200 with distinct request IDs, and the deployment log query found no new `catalogue_dependency` diagnostics. This is a verified clean sample, not a production-scale reliability certificate; the prior upstream-500 diagnosis remains open.
- Expiry phase: production has an active hourly `perkdrop-expire-lifecycle-hourly` job calling `perkdrop_private.expire_catalogue()`, plus minute-level booking reconciliation and 15-minute offer-session closure. Current snapshot has zero active catalogue rows past end, zero active expired merchant offers and zero active expired sessions.
- Social phase: `social_publisher_config.enabled=false`; the only current carousel job remains `verification_failed` with no approval timestamp. Buffer key material was not read, and no draft, schedule or publication was created.
- Reliability diagnostics follow-up: deployed `perkdrop-catalogue-api` version 24 with the existing request correlation plus sanitized `x-perkdrop-query-failure` and `x-perkdrop-query-ms` headers on failed health/catalogue queries. Vercel health, sitemap and dynamic catalogue logs now propagate those labels without exposing database error text. Commit `0c9c64c` is pushed to GitHub `main`; Vercel production deployment `dpl_Bww9Qe7PSHNyHbhTBH9924KN5T6v` is READY and serving `perkdrop.au`. Live verification returned `/api/health` 200 (`liveDrops:53`, `apiVersion:17`), direct catalogue 200 (`total:53`, request ID present), and `/sitemap.xml` 200; Vercel reported no matching dependency logs or runtime errors in the 15-minute post-deploy window. The upstream-500 cause remains open until a recurrence or Supabase function-log evidence identifies it.
- Reliability dependency follow-up: the catalogue function now pins `npm:@supabase/supabase-js@2.102.0`, the documented version with built-in bounded PostgREST retries for transient 408/409/503/504/network failures. The deployment connector bundled and activated Edge version 25. Three sequential direct production probes returned HTTP 200 with distinct request IDs in 0.40–0.48 seconds. This improves transient resilience but does not claim the historical upstream-500 cause is resolved.

- Migration 20260914115217_production_notification_readiness fixes a production CHECK constraint that rejected the worker's processing state.
- Worker records provider_accepted + provider message ID/time, not delivery; retains legacy sent as explicitly unconfirmed.
- Stable idempotency key and frozen complete request across retries; up to five leases, exponential backoff, 15-second HTTP timeout, 10-minute lease, retries within 23 hours of first attempt. After the boundary, delivery_unknown requires provider reconciliation; no blind resend outside Resend's 24-hour key window.
- Persistence failures are not counted as successful sends. Lease compare-and-set prevents stale workers overwriting newer work. Final suppression, public-business and release checks happen before provider call.
- Sender enabling alone releases nothing: release_after and released_event_types are also required. Older rows remain held. Consumer queue is not claimed by this approval dispatcher; it requires separate approved release work.
- Outbox/config and privileged claim/gate RPCs remain service-only; admin API keeps JWT and approved-admin checks.
- Admin portal displays distinct queue/attempt/acceptance/unknown/legacy/failure/policy states. Approval confirmation says queued, not delivered.
- Verification/recovery callbacks preserve the selected slug even if directory loading has not finished.
- Directions accept existing named Union IDs and use canonical DB destinations, never URL-provided coordinates; missing coordinates no longer become 0,0. Excluded linked businesses cannot receive a directions redirect.

## Three listings

| Business | Completed/preserved | Remaining |
|---|---|---|
| Union Hotel, 70 Waymouth St | Existing 3 offers, supplied images and linked profile retained; named-special directions fixed. Lunch remains Mon-Thu 11:30-14:30, drink required, specials/drinks excluded, party 1-6, 20 diners/service, booking first. Lunch row unchanged. | Own-account participation/authority approval. Eligible pint options and steak cut/size/inclusions not invented. |
| Grand Junction Tavern, 174 Grand Junction Rd, Pennington | Checked exact name/address/site/phone/suppression/duplicate/exclusion state. Created one unclaimed public-source profile, linked existing Monday 17:00-21:00 BOGO-main offer. Preserved exclusions. Corrected both profile and offer destination to -34.8516159, 138.5297088. | Exact-branch photo reuse permission; still labelled placeholder, no partnership claim. |
| Woodville Hotel, 878 Port Rd | Existing linked offer and Monday 17:00-21:00 window preserved. Purchased-main condition and unknown child eligibility stay prominent. | Age eligibility, eligible promo-menu/inclusions and image permission. Current standard kids menu is not proof that its drink/ice-cream inclusions apply to the free-meal promotion. |

Grand Junction source: https://grandjunctiontavern.com.au/contact/ and https://grandjunctiontavern.com.au/events/buy-1-get-1-free/.
The official contact page's embedded place identity 0x6ab0c7b2c9d12767:0x23668e26014a9c09 was independently opened through the published address link's named venue result. Name, full address, official website and phone matched. Destination !3d/!4d coordinates, not map viewport, were used. This is a venue destination, not a certified accessible entrance.

Woodville event/FAQ/current menu checked: https://woodvillehotel.com.au/event/monday-night/, https://woodvillehotel.com.au/frequently-asked-questions/, https://woodvillehotel.com.au/wp-content/uploads/2026/08/Woodville-Hotel-MENU-JULY-26.pdf. Relevant menu pages visually inspected; no age condition found. No new menu offers published.

## Controlled test handoff — no sends authorised yet

1. Restore authorised Auth-config/provider visibility through the existing project organisation. Read and redact credentials; inspect sender verification, SMTP/hook, templates, limits and errors.
2. Confirm site URL https://perkdrop.au and required callback destinations, including https://perkdrop.au/claim?merchant=union-hotel-adelaide and the recovery variant with &recovery=1. Do not broaden production redirects to arbitrary hosts or use verification bypasses.
3. Obtain approval for one owner-controlled, non-admin, non-team QA mailbox AND the actual rendered verification/recovery templates and clearly labelled transport-test message. Do not reset the administrator.
4. Verification test: sign up QA identity, recipient reports receipt, uses link, confirms exact business selection. Never submit a real business claim. Record provider acceptance, delivery event, actual receipt and link use separately.
5. Recovery test uses that QA identity only. Recipient controls password entry. Check selected business and recovery screen; expired/reused links already covered in isolation.
6. Approval transport test must say “PerkDrop approval-email transport test — no business access granted.” Body: “This is the approval-notification delivery test you authorised. No business claim has been approved and no ownership or access has been granted. Please confirm receipt to PerkDrop.” Do not manufacture an approval/membership/outbox business event.
7. After sender verification and explicit release approval, set an intentional future release boundary and only approved event types. Reinspect backlog first. Do not set release_after to an old date or reset exhausted job state/key without provider reconciliation.
8. Real owner separately consents, uses their own verified account, submits authority evidence, receives staff review and approval, then logs in themselves and performs one permitted reversible profile change. No offer/payment required.

## Verification and rollback

Initial runtime commit: 0cdf4ba6edb4d8aafed64f0c7d2b0d27e6e1d835. A final retry-state correction also retains delivery_unknown after a later provider rejection; it cannot disprove earlier acceptance. Protected Vercel preview dpl_BdYCngZRZXnX5SAaFNmQ2wHxPZ9G READY, claim route 200/noindex with new callback fallback/status labels. Final main/production release receipt is supplied in the task handover.

Checks: build/lint; four Edge entrypoints Deno typecheck; 59 isolated PostgreSQL checks; 8 worker/navigation/callback tests plus 7 discovery tests; 12 availability, 2 inline-script, 1 analytics, 2 saved-listing tests; 10 model-harness assertions. Isolated official Auth: 12 checks, four loopback-only messages. Mobile portal fixture: 18 checks. Live three-business browser journey: 54 checks, no claims/bookings/messages. The complete 34-route production smoke rerun passed (expected missing-offer 404s included). The initial concurrent run returned four 503s from catalogue-dependent routes; direct recheck produced one further 503 before recovery. Vercel recorded these responses but no exception cluster. Catalogue API direct checks subsequently returned expected 200/404 results. Exact upstream cause remains unproven; this is not a load/reliability certification. A cold browser-launch timeout was retried successfully; it is not an application result. Local tests are not production delivery evidence.

Active Supabase versions after deployment: notification-dispatch 5, nav 2, admin-commercial 12 (JWT retained), portal 19. Migration was applied through the authenticated connector; local filename matches its actual ledger version. CLI migration-new hit an existing-directory error, so the local file was created with the same reviewed SQL and aligned to the applied ledger.

Rollback: keep enabled=false and release gates empty; retain acceptance IDs and frozen requests. Roll back frontend/Edge code independently if needed; do not drop evidence columns. Grand Junction repair is recorded in the guarded SQL alongside this report; any reversal must first check for newer edits/ownership, restore only its prior link/pin metadata and soft-delist the newly added profile (never destroy new user records). Union/Woodville data were not modified. Existing opt-outs remain excluded; no new contact attempted.

The personalised, unsent business drafts and staff checklist are supplied in chat, not hidden in a local-only file.
