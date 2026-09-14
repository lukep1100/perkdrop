# Production onboarding continuation — 14 September 2026

Narrow continuation from main/prod d0483687b16d4d2e7d640da516f88e293cc3970e. No broad redesign, outbound email, social publication, paid activity, claim, membership, booking or capacity hold.

## Email: evidenced state, not a delivery claim

- Production public Auth settings return 200: email enabled, signup enabled, mailer_autoconfirm false. Verification remains mandatory.
- Signup verification, resend and recovery use Supabase Auth. A connected Gmail inbox is not an Auth sender.
- Auth Management configuration and service-error logs remain unread: the available Supabase connector has database/deployment access but no Auth-config/log method; local CLI has no Management token; the signed-in dashboard identity lacks the existing project's organisation access. Do not extract connector credentials or weaken access controls.
- Required documented read: GET /v1/projects/{ref}/config/auth, with auth:read (OAuth) or auth_config_read (fine-grained permission). Use the existing authorised account/secure normal login flow, never paste secrets in chat.
- SMTP vs Send Email hook, provider/sender verification, site URL, exact allow-list, templates and actual rate limits are therefore still unverified. Default Supabase SMTP is team-address-restricted; a team-only test would not establish external owner delivery. It is NOT established that production uses that default.
- Intended claim approval provider: Resend API. enabled=false, sender absent, dispatch secret present (not displayed); Edge RESEND_API_KEY presence remains unverified. No matching mail-provider Vault secret names were present, which does not establish Edge environment-secret absence.
- Both merchant and consumer notification backlogs were empty. Production merchant claims and memberships were zero before/after repairs.
- Highest production delivery stage for all three paths: **not tested / no message sent in this task**. No recipient or exact-message approval received. No actual inbox receipt, provider delivery event or link use evidenced.

## Applied technical repairs

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

Runtime commit: 0cdf4ba6edb4d8aafed64f0c7d2b0d27e6e1d835. Protected Vercel preview dpl_BdYCngZRZXnX5SAaFNmQ2wHxPZ9G READY, claim route 200/noindex with new callback fallback/status labels. Final main/production release receipt is supplied in the task handover.

Checks: build/lint; four Edge entrypoints Deno typecheck; 59 isolated PostgreSQL checks; 7 worker/navigation/callback tests plus 7 discovery tests; 12 availability, 2 inline-script, 1 analytics, 2 saved-listing tests; 10 model-harness assertions. Isolated official Auth: 12 checks, four loopback-only messages. Mobile portal fixture: 18 checks. Live three-business browser journey: 54 checks, no claims/bookings/messages. A cold browser-launch timeout was retried successfully; it is not an application result. Local tests are not production delivery evidence.

Active Supabase versions after deployment: notification-dispatch 4, nav 2, admin-commercial 12 (JWT retained), portal 19. Migration was applied through the authenticated connector; local filename matches its actual ledger version. CLI migration-new hit an existing-directory error, so the local file was created with the same reviewed SQL and aligned to the applied ledger.

Rollback: keep enabled=false and release gates empty; retain acceptance IDs and frozen requests. Roll back frontend/Edge code independently if needed; do not drop evidence columns. Grand Junction repair is recorded in the guarded SQL alongside this report; any reversal must first check for newer edits/ownership, restore only its prior link/pin metadata and soft-delist the newly added profile (never destroy new user records). Union/Woodville data were not modified. Existing opt-outs remain excluded; no new contact attempted.

The personalised, unsent business drafts and staff checklist are supplied in chat, not hidden in a local-only file.
