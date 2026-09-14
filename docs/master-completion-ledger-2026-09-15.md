# PerkDrop master completion ledger

Snapshot: 15 September 2026, after commit `a0eda29` and production deployment `dpl_4YJ5NbL5EpuMDc56EyGf7onD6ohi`.

This is an evidence ledger, not a launch certificate. `VERIFIED` means the stated acceptance check passed in the named environment. A blocked or untested participant/provider requirement remains non-green.

| Area | Status | Evidence / acceptance state | Remaining dependency |
|---|---|---|---|
| Auth site URL and callback handling | VERIFIED / NEEDS LIVE OWNER TEST | `/claim` and the four supported same-site redirect forms are implemented; `claimRedirect()` preserves a validated merchant slug and recovery flag. | A real verification/recovery message and link-use journey still needs owner-approved QA recipient and inbox confirmation. |
| Auth transport | EXTERNALLY BLOCKED | Production configuration was read as default Supabase mail with custom SMTP disabled. | Owner must approve/establish the production sender/transport; no password, token or secret in chat. |
| Approval notifications | EXTERNALLY BLOCKED | `merchant_notification_config` is disabled, `provider=resend`, `from_email` is unset; queue/release gates remain closed. | Owner-controlled non-admin recipient, sender/domain, exact test messages and transport approval. |
| Business claiming / owner access | NEEDS LIVE OWNER TEST | Claim, role, consent, authority-evidence, competing-owner and pending-state gates are implemented and isolated concurrency-tested. | A real authorised business representative must submit, be reviewed and use the resulting access. |
| Public UX / PWA | VERIFIED | Production route smoke and prior responsive/browser evidence cover public discovery, saved items, policy/contact pages, PWA manifest/service worker and no-account browsing. | Full real-device Safari/Android pass remains untested. |
| Search, location, list/map agreement | VERIFIED WITH DATA GAPS | Shared filters, manual location fallback, directory/offer distinction, coordinate validation and co-located marker grouping are deployed. | 81 current non-removed merchant rows have missing coordinates; ambiguous rows require evidence, not guessed pins. |
| National discovery | VERIFIED ENGINEERING PATH | Service-auth trigger, official-site verification, candidate-only/unclaimed seeding and canonical vertical taxonomy are deployed. | More verified supply requires authoritative sources and/or participating businesses; no unapproved bulk seed run. |
| Photos / genuine-photo rights | NEEDS WORK | Rights gates, provenance fields, neutral fallback and decoding checks are deployed; existing verified heroes are limited. | Real authorised venue photography and rights evidence are still missing for most businesses. |
| Offer data / availability / expiry | VERIFIED SAFEGUARDS | Canonical vertical/inventory contracts, Australian-timezone service windows, expiry filtering and hourly expiry job are deployed. | Current live catalogue uses multiple source tables; ongoing source freshness and conflicting terms still need operations. |
| Bookings / capacity / redemption | VERIFIED ISOLATED; NOT LIVE-OWNER VERIFIED | Atomic capacity, retry and redemption safeguards have isolated database coverage; no live booking or redemption was made for QA. | Controlled real-owner/consumer pilot is required for end-to-end confirmation. |
| Opt-out / delisting / reimport | VERIFIED ISOLATED | Normalized suppression, policy-based reversible delisting, exclusion ledger and import guards are deployed and tested without sending outreach. | External/manual senders still need independent pre-send eligibility checks. |
| Security / RLS / roles | VERIFIED ENGINEERING CHECKS | Service-only tables, role-aware responses, claim/invite authorization, upload rights checks and Vault-only Buffer access are deployed. | Supabase leaked-password protection remains an advisory item requiring owner policy decision. |
| Analytics / SEO / metadata | VERIFIED ENGINEERING CHECKS | Tracked-value-only analytics, deduplicated events, metadata/sitemap behavior, canonical links and PWA assets are deployed. | No claim of complete ranking, attribution or production-scale performance. |
| Catalogue reliability | VERIFIED MITIGATION / UNRESOLVED DIAGNOSIS | `/api/health` and direct catalogue health returned 200; six concurrent catalogue reads returned 200/52 rows; `catalogue_api_failures` currently has 0 rows. | Historical 500/503 root cause is not proven; Vercel Hobby retention leaves insufficient surrounding traces. |
| Social publishing | BLOCKED / LOCKED | Job `461112dc-4de4-4157-b3a0-770749f65959` remains `verification_failed`; slide 04 fails complete-PNG validation; Buffer publishing is disabled and no draft exists. | Reattach the exact intact five originals, then owner review/approval. No schedule or publish action is permitted. |
| Native app | NOT APPLICABLE | The brief requires preserving the existing PWA and does not authorize a new iOS/Android/store app. | None unless product scope changes explicitly. |

## Current production counts

- Supabase project: DueMate → PerkDrop, reference `khzpdyyywiucfhubxkev`, status `ACTIVE_HEALTHY`.
- Supabase query: 320 non-removed merchants, 81 without plausible stored coordinates, 0 catalogue failure-ledger rows.
- Public `/api/health`: 52 live catalogue rows reported by the deployed aggregator.
- Raw `catalogue_items`: 78 total, 30 expired rows retained for history; public API excludes expired rows.

## Latest implementation and release evidence

- `a0eda29` — expose complete canonical inventory units in the merchant editor; pushed to `origin/main`.
- `5161cff` — make merchant quick drops taxonomy-aware; pushed and deployed.
- `619ea14` — report tracked merchant value only; pushed and deployed.
- Supabase `perkdrop-portal` v21 is ACTIVE with `verify_jwt=false`, matching the existing portal contract.
- Vercel production deployment `dpl_4YJ5NbL5EpuMDc56EyGf7onD6ohi` is READY and aliased to `perkdrop.au` / `www.perkdrop.au`.

## Tests recorded

- `npm run lint -- --no-cache` — passed.
- `npm run build` — passed.
- `npm run test:inline-scripts` — 2/2 passed.
- Existing discovery, availability, analytics, saves, database, marketplace-harness and smoke suites — passed in the prior integrated release; latest smoke still passes all expected 200/404 outcomes.
- Live checks after the latest release: `/claim` 200 with canonical controls; `/api/health` 200; direct catalogue health 200; six concurrent catalogue reads 200; current Vercel runtime errors in the selected 15-minute window: none.

## Owner action bundle

1. Approve a legitimate Auth/application sender and owner-controlled non-admin QA inbox, plus the exact verification, recovery and clearly labelled approval-transport messages; provide credentials only through the provider/Vault workflow, never chat.
2. Supply the intact exact five social PNG originals, including a valid replacement for the truncated fourth file; do not approve the existing failed job.
3. Nominate a real authorised business representative for the first supervised claim and first-access pilot.
4. For definitive catalogue 503 diagnosis, retain/export correlated Vercel/Supabase traces around a fresh reproducible failure or enable an appropriate log-retention window.

No owner action above has been performed by this job.
