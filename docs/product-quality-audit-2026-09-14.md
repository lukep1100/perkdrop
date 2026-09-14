# PerkDrop product-quality and launch-readiness report

Audit date: 14 September 2026. Production: https://perkdrop.au.

Verified production code: `c10a352558c608d123dd1c65c0f15c2c7b62eb12` on `main`, built by the existing GitHub → Vercel integration. Implementation work originated on `codex/product-quality-audit`. This report is also retained on that audit branch.

This is an engineering and product assessment, not a legal compliance certification, penetration test, or load-test certificate. It combines live browser checks, public HTTP/image verification, production SQL inspection, code review, isolated PostgreSQL tests, and actual production deployments. No real business was claimed, no booking/capacity hold was made, and no outreach or social post was sent.

## 1. Executive summary

PerkDrop is materially more usable and safer, and the repaired code is live—not just in local files. I would now run a controlled local pilot. I would **not** yet spend heavily to bring 100,000 visitors or promise effortless onboarding for 500 businesses.

The biggest remaining problem is supply quality: 309 active business listings, but only 43 active catalogue offers; no business hero photos; 84 businesses without confirmed map coordinates; and no production evidence yet of a complete verified-owner onboarding journey. More feature breadth does not solve that.

Scores below are my evidence-informed product judgement, not laboratory measurements or a mathematical average.

| Area | Before /10 | After /10 | Main reason |
|---|---:|---:|---|
| Usability | 4 | 7 | Clearer homepage, honest offer actions, working search and saves |
| Mobile | 4 | 7 | Font repair, compact layouts, useful touch targets, eight-width checks |
| Speed | 4 | 7 | Large card images optimized; directory/map code loaded only when needed |
| Reliability | 4 | 7 | Fixed broken portal JavaScript, map lifecycle errors, route/error distinctions |
| Maps | 3 | 6 | Directory businesses included; location fallback and grouped pins work |
| Images | 3 | 4 | Failures handled honestly, but actual business-photo coverage is still zero |
| Business claiming | 2 | 6 | Working prefill and authentication UI, atomic verified-email claims; live approval untested |
| Data quality | 5 | 6 | Deterministic repair and durable guards; substantial completeness gaps remain |
| SEO | 4 | 6 | Correct 404/410/503 behaviour, metadata and sitemap handling; still client-heavy |
| Security | 5 | 7 | Claim/invite authorization, role-specific responses, suppression and cache privacy |
| Overall launch quality | 4 | 6.5 | Credible pilot, not proven mass-market readiness |

## 2. What I fixed

| Problem | Impact | Change | Verified result |
|---|---|---|---|
| Body font reset overrode the intended font | Public site rendered in Times New Roman | Corrected inheritance and restored Poppins | Live computed font and screenshots checked |
| Long, jargon-heavy discovery header | Mobile users had to work to find offers | Shortened homepage copy, removed redundant hero actions, retained brand colours | Responsive home checked from 320–1280 px |
| Small controls, zoom restriction and weak focus treatment | Harder mobile/keyboard use | 44 px native-button targets on key pages, 16 px form inputs, zoom enabled, visible focus, `en-AU` | Four page families tested at eight widths; no horizontal overflow |
| Bright gradients behind small white control text | Contrast could be poor even when automated scanning was inconclusive | Darker pink/purple gradients for public primary controls and badges | Final production stylesheet and controls checked |
| Public-source offers advertised as instant claims | Visitors could expect a pass that did not exist | Fulfilment labels distinguish official offers, booking, tickets and real claims | Unit tests; public feed and booking page checked |
| Conditional freebies treated as zero-cost outings | Misleading expectations about minimum spend | Excluded buy-one/get-one, paid-adult and purchase-dependent cases from free classification | Regression tests pass |
| “Free today” implied a verified daily schedule | Recurring listings could be misrepresented | Reworded the affected discovery views to require checking days and times | Live labels checked; no claim of a complete schedule engine |
| Map used only catalogue offers | Most directory businesses were undiscoverable on the map | Added directory layer, active-offer filter, shared search/city filtering, coordinate validation and business profiles | Live offers and directory cards; working pin popups and filters |
| Same-coordinate tenants obscured each other | Businesses at shopping centres disappeared behind pins | Grouped exact-coordinate entries into one popup while preserving every listing | Co-located groups inspected; no businesses merged or deleted |
| Leaflet animations survived a map teardown | Rapid filter/city changes threw `_leaflet_pos` errors | Stop animations before removal and disable transition races during rebuilding | Repeated production journey has no new JavaScript exceptions |
| Denied geolocation did not provide a clean alternative | Visitors could get stuck | Open manual city selection, preserve list discovery, trap modal keyboard focus; noninteractive toast cannot intercept clicks | Simulated denial → Canberra selection → Adelaide reset passes |
| Directory market filtering disagreed with returned city | Union Hotel disappeared from an Adelaide search because `market_id` was null | Apply the same `market_id`/`primary_city` fallback for filtering and output | Live “Union Hotel” + Adelaide query and claim search pass |
| Four generic stock-image sources and two failed image sources | Photos could be misleading or visibly broken | Withheld those images; kept original database URLs; added labelled neutral placeholder and runtime fallback | All 33 retained unique source URLs decode; injected image failure becomes placeholder |
| Three very large discovery card images | Avoidable megabytes on mobile | Strictly allowlisted Next image optimization; use an actual Union Hotel still on cards, retaining campaign photography | 97.2–98.9% byte reductions for those three assets |
| Portal HTML template lost JavaScript quote escapes | Login tabs, search and prefill never initialized | Preserve raw template escaping; added tests for rendered inline JavaScript | Live login/create-account tabs, business search and prefill now work |
| Claim presentation mixed ownership with creating offers | Excessive perceived onboarding effort | Replaced the nine-step proxy presentation with three steps; concise copy, selected business and website prefill, “Change business” action | Clean anonymous claim UI at eight widths |
| Exclusive-offer label could block an unclaimed business | “Exclusive” was incorrectly treated as ownership proof | Derive claimability from actual listing ownership state | Unclaimed business remains eligible even if an offer is exclusive |
| Claim retries/races could create inconsistent records | Duplicate reviews and possible access mistakes | Atomic, service-only verified-email claim RPC, consent/role checks, merchant lock, pending-claim uniqueness and rate limit | Twelve concurrent retry scenario creates one pending claim in isolated PostgreSQL |
| Invite acceptance and token creation had correctness/security gaps | Wrong recipient or race could alter membership | Fixed token-function shadowing; verified invited-email match, locked single-use acceptance, expiry/revocation checks and protection for existing memberships | Deno check and real PostgreSQL invite/role tests pass |
| Merchant responses contained fields beyond some roles' needs | Unnecessary exposure of team, ownership and finance data | Project responses by role; fetch only authorized team users rather than listing all Auth users | Visibility tests pass; anonymous merchant API returns 401 |
| Dashboard “30-day” statistics included older data/double counts | Misleading commercial reporting | Apply time windows and remove duplicated redemption/conversion counting | Source and regression review; authenticated dashboard UI still needs owner validation |
| Suppression could disagree with contacts or be bypassed on import | Opted-out addresses could become eligible again | Central normalized suppression checks and database import/send-state guards; atomic unsubscribe; durable hard-bounce handling | Four contradictions repaired; zero suppressed eligible contacts and zero suppressed ready messages |
| Marketing unsubscribe and delisting lacked distinct durable treatment | Risk of removing the wrong business or reimporting an explicitly removed one | Separate evidence-backed directory-exclusion ledger and soft-removal/reimport protections | Isolated tests cover unsubscribe without removal and explicit removal/reimport rejection |
| Missing, expired and unavailable pages were conflated | Bad links could be called expired; outages could look like missing data | Real 404, expired 410 and upstream 503/Retry-After handling; bounded upstream fetches | Invalid links return 404; actual ended Kidchella listing returns 410 |
| Weak metadata/sitemap failure handling | Poor crawlability and misleading partial results | Page/venue metadata and initial semantic content; sitemap fails explicitly instead of caching incomplete output | Production metadata and sitemap HTTP checks pass |
| Public service worker could cache sensitive/stale content | Private pages or old availability could be misleading | Cache only explicit public assets; never cache private responses or availability | Offline test shows connectivity error, not stale deal cards |
| Analytics rerenders duplicated views; new event types were not persisted | Discovery measurement was incomplete | View deduplication, UTM persistence, public merchant attribution; aligned DB event constraint with API | Production map-marker/business-open events persisted with merchant IDs; contract test added |
| Saved offers linked to internal IDs | “Save now, find later” produced broken destinations | Server resolves human-readable labels and canonical slugs in batches; removal also updates local heart state | Live save → Saved tab → correct offer → Remove passes; test save cleaned up |
| Booking-gallery dots were 7 px targets and “back” linked to itself | Hard mobile controls and redundant navigation | Larger touch areas, reduced-motion support, useful food-discovery back link | Campaign layout/party-size controls pass without creating a booking |

Removed only provably unreachable duplicate browser implementations. No broad rewrite or replacement application was introduced.

## 3. Map audit

| Metric | Result |
|---|---:|
| Active permanent business listings | 309 |
| Businesses with present/plausible Australian coordinates, before | 224 (72.5%) |
| Businesses with present/plausible Australian coordinates, after | 225 (72.8%) |
| Missing coordinates, after | 84 |
| Present coordinates outside the Australian plausibility bounds | 0 |
| Deterministic coordinate repairs | 1 — Union Hotel |
| Active catalogue offers | 43 |
| Catalogue location rows eligible for mapping | 51 |
| Distinct merchants represented by those catalogue locations | 33 |
| Potential duplicate business groups requiring review | 1 |

The 225 businesses are eligible for mapping across their city/location filters, **not 225 separate pins in the default viewport**. In the tested Adelaide view, offers and directory data produce 33 mapped entries, grouped into 24 physical markers. The list contains 20 offer cards and 61 directory-only business cards; 46 combined entries explicitly lack a confirmed pin. The active-offers-only filter removes directory-only cards and shows 15 markers for those offers.

Union Hotel was repaired only because its exact stored address matched the merchant-authorized linked offer's coordinates. Australian bounding-box validity is not independent address-level geocoding verification. No suburb-centre coordinates were invented.

The duplicate candidate is two Hungry Jack’s records sharing a state-level “WA” address and website. That is insufficient evidence of the same physical outlet, so neither was merged/deleted. Shared coordinates at Rundle Place, Canberra Centre and Melbourne Central can represent legitimate tenants and were preserved.

Next: verify the 84 missing locations against authoritative address evidence; review the Hungry Jack’s pair; replace city-centre assumptions with actual distance-based discovery; add scalable proximity clustering and server pagination before much larger inventory. Existing hard limits (200 catalogue source rows and bounded directory loads) do not truncate today's inventory, but are not a growth strategy.

## 4. Image audit

- All 309 active businesses have no `hero_image_url`: genuine business-photo coverage is **0/309**. Rights metadata is 1 merchant-authorized, 57 candidates and 251 missing; an authorization flag alone is not an image.
- All 43 active offers originally had image fields. The baseline had 38 unique source URLs, two actual HTTP failures, four generic stock-image uses and four payloads above 1 MB.
- The failed sources were OPSM (403) and SWELL (404). Their original URLs remain in the database with an unavailability marker. I did not fabricate replacement venue photos.
- Current output: 51 location rows, 45 with source imagery and six using a clearly labelled neutral fallback. At offer level, 37/43 retain source imagery.
- Final live fetch/decode check: **33/33 retained unique image URLs decode successfully**, no current HTTP/decode failures. One upstream server incorrectly labels a valid WebP as `webp` rather than `image/webp`; this remains a source-header concern.
- A deliberately failed browser image was replaced by the labelled SVG fallback and loaded successfully.
- Image optimization is a delivery repair, not newly acquired photography. The remaining gap needs real, authorized venue photos and maintained source/rights records.

Separate social-carousel finding: all five exact original files are hosted with HTTP 200 and `image/png`, but original `04.png` has a truncated IDAT chunk. Four decode correctly; that file does not. Its private job remains `verification_failed`. HTTP success is not valid-image verification.

## 5. Claim flow

Before: the proxy presented a nine-step onboarding sequence, while the underlying portal mixed claiming, approval, creating Drops and redemption. More importantly, broken generated JavaScript prevented the controls from initializing.

After: **find/select the business → sign in and confirm your role → PerkDrop verifies access**. An existing business link arrives preselected with its website filled in. The user can change the listing. Creating an offer is no longer presented as part of obtaining ownership access.

Still required: verified email, identity/contact name, business role, authority/terms and privacy consent, and manual PerkDrop review of appropriate evidence. Claiming is not automatically approved. Existing ownership cannot be stolen through the claim/invite paths tested.

Mobile: selected-business view, login/signup controls and search were checked at 320, 360, 375, 390, 412, 430, 768 and 1280 px. No horizontal overflow or undersized visible native buttons on those checks.

Boundary: no real business was claimed and no owner account was impersonated. Signup-email delivery, a real approved-owner login, admin approval notifications and a complete live merchant dashboard workflow remain unverified. The production database still contains zero business claims and zero memberships. Database-level claim/invite transactions were tested with isolated fixtures, not production claims.

## 6. Business opt-out / suppression audit

There are 68 normalized suppressed addresses, with four merchant-level do-not-contact flags. The migration preserves the existing registry and adds centralized eligibility checks, normalized unique emails, advisory-lock protection, propagation to contacts/ready messages, and guards against case/space variations on reimport. Unsubscribe updates are atomic and idempotent. Explicit hard/permanent bounces become durable suppression; transient failures are not invented as permanent bounces.

Four contact status contradictions were repaired, retaining previous status in metadata. After deployment: **zero suppressed-but-eligible contacts and zero suppressed draft/approved messages**. No outreach was sent as a test.

Can I certify that *all* outreach respects it? **No.** Database-mediated imports, approvals and sent-state transitions are protected. An external sender using an old exported address list could still bypass the database. Every external sender must recheck eligibility immediately before sending, and its integration needs independent verification.

Marketing opt-out does not remove a directory listing. Explicit website-removal evidence uses a separate service-only exclusion ledger, soft-removes the business, deactivates linked public offers, and blocks reimport by matching ID/slug or exact normalized name plus nonempty address. Tests demonstrate both behaviours independently.

No explicit removal requests were identified in the scoped records. Four old “removed” prospect records were not treated as legal delisting requests. There are zero entries in the new explicit-removal ledger. This means the mechanism is installed and tested—not that I fabricated removal instructions.

Could a suppressed business reappear? Exact known suppression/removal identities are guarded. A genuinely different address or sufficiently changed identity can evade exact matching and needs review; there is no claim of perfect entity resolution or coverage of private communications outside the inspected records.

## 7. Remaining user-experience issues

| Priority | Remaining issue |
|---|---|
| P0 | No unmitigated P0 was found in the public paths exercised. This is not a blanket security or load guarantee. |
| P1 | Most businesses have no active offer and none has a genuine hero photo; national breadth feels thinner than the listing count suggests. |
| P1 | 84 business locations still cannot be pinned with confidence. |
| P1 | “Tonight”/recurring-offer usefulness lacks a dependable structured day/time and freshness model. Existing editorial titles can still require review. |
| P1 | Real verified-owner signup → approval → dashboard needs a supervised live pilot. Manual review throughput is not proven for 500 businesses. |
| P1 | Production scale has not been tested; current row limits and external image/map dependencies need capacity planning before paid traffic. |
| P1 | Social carousel remains blocked by corrupt original slide 04. Preserve the publish lock. |
| P2 | My Perks/recovery screens still contain technical explanations and expose secondary concepts before many users need them. Email recovery transport is visibly not connected. |
| P2 | Discovery has too many adjacent categories/features relative to available inventory; Radar/Standby are ahead of the core dinner-deal proposition. |
| P2 | Exact-coordinate grouping helps, but nearby nonidentical pins can still overlap until users zoom. |
| P2 | A full keyboard/screen-reader and real-device Safari/Android pass remains necessary; emulated widths are not those devices. |
| P2 | Confirm footer social-account ownership and login-protected destinations manually; no claim that third-party platform ownership was authenticated. |
| P3 | Further visual consistency between the public catalogue, business portal and private consumer screens. |

## 8. Security

Implemented: verified-email/role/consent gates and atomic ownership claims; single-use email-matched invitations; least-privilege merchant response fields; privileged RPC execution limited to service role; RLS on the exclusion ledger; durable suppression; payload limits; removal of claim-hold credentials from tracking metadata; no-store private responses; public-only service-worker caching; strictly allowlisted image optimization with no local-IP/SVG optimization access.

Live anonymous claim and merchant API requests return 401. Isolated tests verify public/authenticated callers cannot execute privileged RPCs and cannot redeem another merchant's entitlement. Secrets were not added to repository code. The Buffer API key remains Vault-only and social publishing remains disabled.

Supabase security advisor still reports **leaked-password protection disabled**. Enable and verify it in Auth configuration: [Supabase password-security guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). The other 61 findings are informational RLS-enabled/no-policy tables in the service-only architecture; they are not evidence that anonymous users have table access. [Advisor explanation](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy).

Package audit reported zero known vulnerabilities, including the production-only dependency audit. That is not proof of an absence of application vulnerabilities. No signed-in owner session or adversarial penetration/load test was performed.

## 9. Performance

Live optimized image responses were HTTP 200, `image/webp`, and fully decoded:

| Card asset | Original bytes | Delivered bytes | Reduction |
|---|---:|---:|---:|
| Union Hotel card (actual still instead of slideshow payload) | 1,301,775 | 36,736 | 97.2% |
| Hijinx / DatoCMS image | 6,152,101 | 77,650 | 98.7% |
| HOTA image | 2,250,741 | 25,480 | 98.9% |

The home page no longer waits for the full business directory; it is fetched on map/search/business views. Leaflet is deferred until a map is actually needed. Initial content and useful errors are semantic HTML. Public image caching has narrow source rules; private data is not made faster by unsafe caching.

One warm, unthrottled production browser sample reported FCP 316 ms, LCP 736 ms, CLS 0 and TTFB about 275 ms. INP was unavailable. This is a spot-check, **not** a representative mobile percentile, before/after benchmark or 100,000-visitor load result. Vercel Analytics and Speed Insights script endpoints both returned 200 in production.

Remaining: at least one unoptimized ~1.9 MB GIF, external image availability, public map-tile capacity, client-heavy rendering and request/row limits. Vercel functions are deployed in `iad1` while Supabase is in Sydney; benchmark an Australian function region before changing deployment topology.

## 10. Tests and verification

| Check | Result and scope |
|---|---|
| Marketplace harness | 10 assertions pass |
| Discovery/visibility unit tests | 7 pass |
| Rendered inline JavaScript | 2 pass; catches the actual portal escaping failure |
| Analytics API/database contract | 1 pass |
| Saved-listing resolution | 2 pass |
| Real isolated PostgreSQL | 37 scenarios pass; 26 existing plus 11 new quality/security scenarios |
| Social exact-media/safety tests | 9 pass, including detection of corrupt original 04 |
| HTTP smoke | 34 requests pass locally and in production; expected 404 cases included |
| Genuine expired offer | Kidchella expired route returns HTTP 410 and “This offer has ended” |
| Browser journeys | 17 checks pass locally and in production; no new JS exceptions |
| Save/retrieve/remove journey | 4 additional live checks pass; exact audit save removed afterward, saved-row count returned to zero |
| Failure states | 4 live-browser checks pass with simulated missing image, aborted catalogue request and offline mode |
| Responsive matrix | Home, map, claim and Union booking page × 320/360/375/390/412/430/768/1280 px |
| Accessibility | Loaded public homepage: axe 4.12.1, 0 violations, 39 passes, 1 incomplete gradient assessment; not a full accessibility certification |
| Build | Next 16.3.3 production build passes locally; Vercel Git production builds READY |
| Type checking | Deno check passes all 10 changed Edge functions. Next's build check also passes; JS pages are not a strict whole-repo TypeScript proof |
| Lint | New safety-focused ESLint configuration passes; not a claim of every optional style/React lint rule |
| Dependencies | `npm audit` / production audit: zero known vulnerabilities |

Database scenarios include 24-way concurrent capacity claims, idempotent retries, booking-first restrictions, hold/release/expiry, party-size inventory, wrong-merchant redemption, single fee posting, role boundaries, recovery, demand privacy, verified invitations, suppression, explicit delisting and concurrent ownership claims. The test harness launches its own PostgreSQL cluster and does not accept a production connection; it does not reproduce the full Supabase Auth/PostGIS/HTTP stack.

Browser tests did not create real bookings, claims, merchant accounts, outreach, or social posts. The only save mutation was a single existing offer saved and removed through the isolated QA consumer browser. Footer links and selected official destinations were inspected; not every external platform or every possible route/authenticated state is certified.

## 11. Production status

- Production URL: https://perkdrop.au (also verified Vercel alias `www.perkdrop.au`).
- Deployed code: [`c10a352558c608d123dd1c65c0f15c2c7b62eb12`](https://github.com/lukep1100/perkdrop/commit/c10a352558c608d123dd1c65c0f15c2c7b62eb12), branch `main`.
- Vercel deployment: `dpl_CFi2kjDZdHv4oV2FxHAtxz6KzVad`, READY, existing PerkDrop project, Git-triggered production build; aliases verified.
- Supabase: existing project `khzpdyyywiucfhubxkev`; authenticated deployment completed through the connected production tools.
- Applied audit migrations: `20260914083459_product_quality_guards.sql` and `20260914091600_discovery_engagement_events.sql`.
- Deployed Edge functions: catalogue API v19, business directory v6, claim v5, portal v16, track v8, unsubscribe v3, merchant API v17, Union slideshow v3, booking page v7 and marketplace v2.
- Post-change data: 309 active businesses, 225 with plausible coordinates, 43 active catalogue offers, 68 suppressions, zero business claims/memberships, zero eligible suppressed contacts, zero suppressed ready outreach, zero explicit delisting requests recorded.
- No production rows were mass-deleted. Unrelated local `AGENTS.md`, `CLAUDE.md` and `supabase/.temp` were preserved.

Social safety state is unchanged: [owner-only preview](https://perkdrop.au/social-publishing?job=461112dc-4de4-4157-b3a0-770749f65959), job `461112dc-4de4-4157-b3a0-770749f65959`, five original assets, `verification_failed`, no approval timestamp, empty `buffer_posts`, publisher disabled. **No Buffer draft, schedule or publication was created.** An intact original 04.png is needed before that carousel can pass verification. The private preview requires the owner's sign-in; I did not bypass it.

## Product opinion

1. **Would I understand PerkDrop immediately?** Yes, from the revised homepage: nearby offers and things to do. “Drops” alone was not sufficiently explanatory; plain-language labels help.
2. **Would I trust the deals?** Selectively. Clear conditions, official links and the booking-first Union flow help. Missing photos, mixed source freshness and unclaimed listings prevent blanket trust.
3. **Would I use it to find something tonight?** I would browse Adelaide food offers, then confirm the day/time with the venue. I would not yet rely on PerkDrop alone for “definitely usable tonight.”
4. **What would stop me?** Finding a business but no useful current offer, incomplete photos/location, and uncertainty whether a recurring title applies today.
5. **One change that most increases consumer adoption?** A small, genuinely verified “usable tonight near you” feed with clear price, conditions and last-checked time—not more categories.
6. **One change that most increases business adoption?** A supervised claim-to-first-offer flow with a clear review turnaround and an immediate preview of what the business will look like.
7. **What feature is unnecessary right now?** Prominent Radar/Standby-style discovery machinery before there is enough timely supply. Preserve working functionality, but do not lead with it.
8. **What feature is missing?** A trustworthy availability/freshness model for recurring offers, linked to a simple report-stale/report-incorrect action.
9. **Strongest part?** The Union Hotel booking-first flow: actual venue photography, the benefit and catch together, diner-based capacity, and no discount code before booking confirmation.
10. **Weakest part?** Directory completeness and merchandising. A large count of unclaimed, photo-less businesses is not the same as a compelling local deals marketplace.

## Next 10 recommendations

| Rank | Concrete next action | Impact | Difficulty | Urgency |
|---:|---|---|---|---|
| 1 | Build a verified Adelaide “tonight” feed from a small set of existing food offers; normalize recurring days/times, actual price/conditions and recheck timestamps | Very high | Medium | Before major acquisition |
| 2 | Obtain real authorized hero photos for the highest-traffic venues; start with the 309 currently missing, prioritizing active-offer businesses | Very high | Medium, operational | Now |
| 3 | Run two or three supervised real-owner claim → email verification → approval → first-offer pilots; record review turnaround and failure points | Very high | Medium | Before business outreach scales |
| 4 | Verify and geocode the 84 missing business locations; manually resolve the Hungry Jack’s candidate duplicate without mass merging | High | Medium | Now |
| 5 | Verify every external outreach sender checks the durable suppression registry immediately before delivery; separately reconcile explicit delisting requests | High | Medium | Before any outreach resumes |
| 6 | Add stale/incorrect-offer reporting and a source-review queue; make checked dates meaningful rather than decorative trust badges | High | Medium | Next release |
| 7 | Load-test discovery, map, claim/rate-limit and invite paths against realistic growth; paginate source queries, plan tile capacity and benchmark Sydney-region Vercel functions | High | Medium–high | Before large paid campaigns |
| 8 | Enable leaked-password protection and complete signed-in role/real-device accessibility tests, including owner/admin/floor/analyst screens | High | Low–medium | Before expanding the merchant pilot |
| 9 | Reduce secondary navigation and technical recovery copy; preserve Radar/Standby but focus the first session on finding, saving and using one offer | Medium–high | Low–medium | Next UX iteration |
| 10 | Obtain the intact original carousel slide 04, reverify all five exact files, and retain explicit owner approval plus the disabled publish/schedule boundary | High for the social workflow | Low once source exists | Before that carousel advances |

Bottom line: the broken paths found were repaired and deployed, and the core public flow is demonstrably better. The next leap comes from trustworthy local supply and real merchant onboarding evidence—not a rebuild or more feature surface.
