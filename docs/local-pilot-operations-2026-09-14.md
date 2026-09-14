# Adelaide local pilot — production outcome and human handoff
14 September 2026. Existing PerkDrop, not a replacement application.

Production is improved, but the proposed ten complete businesses, five well-served dinner days, and first real-owner onboarding milestone are **not achieved**. Two defensible Union specials are live; uncertain photos are held rather than represented as cleared. Policy-based delisting is live. This report separates recorded schedules, source verification, reuse rights, business approval and actual ownership.

## A. Consumer choice

Pilot: **Adelaide inner metro, within 12 km straight-line distance of Victoria Square (-34.9285, 138.6007)**. This is not travel distance. National discovery and non-food categories remain intact. Distinct businesses use merchant IDs, resolving formerly unlinked AGSA offers to the same existing business; remaining unlinked records use normalised names.

| Measure | Before | After | Interpretation |
|---|---:|---:|---|
| Active pilot catalogue offers | 19 | 21 | Two new offers at one existing pub |
| Useful distinct pilot businesses (source grades A/B) | 11 | 11 | Does not mean eleven permission/location-complete businesses |
| Strong pilot offers (source grade A) | 9 | 11 | Six distinct businesses in both snapshots |
| National active catalogue offers | 43 | 45 | No new business added to inflate choice |
| National grades A/B/C/D | 17/7/14/5 | 19/7/14/5 | Grade is source quality, not owner approval |
| Explicit service windows nationally | 17 | 20 | Two new specials plus Woodville's repaired Monday window |
| Public directory businesses | 309 | 307 | Two policy-based soft-delistings |

Baseline analysis clock is 2026-09-14 10:30 UTC, not an exact database capture timestamp. After snapshot was captured at 11:03:47 UTC; final policy aggregates at 11:16:06 UTC. Supply calculations use the existing public availability engine, not an independent permissive filter.

### Next seven local calendar days

B/O means distinct eligible **businesses / offers**. Each cell is eligibility under the currently recorded schedule, not a future source, seat or booking guarantee. All four columns are shown even where identical.

| Adelaide date | 17:00 B/O | 18:00 B/O | 19:00 B/O | 20:00 B/O |
|---|---:|---:|---:|---:|
| Mon 2026-09-14 | 3/3 | 3/3 | 3/3 | 3/3 |
| Tue 2026-09-15 | 1/1 | 1/1 | 1/1 | 1/1 |
| Wed 2026-09-16 | 0/0 | 0/0 | 0/0 | 0/0 |
| Thu 2026-09-17 | 0/0 | 0/0 | 0/0 | 0/0 |
| Fri 2026-09-18 | 1/1 | 1/1 | 1/1 | 1/1 |
| Sat 2026-09-19 | 0/0 | 0/0 | 0/0 | 0/0 |
| Sun 2026-09-20 | 0/0 | 0/0 | 0/0 | 0/0 |

Baseline: Monday 1/1 at each time, all other dates 0/0. After: Monday includes Union Hotel, Grand Junction Tavern and the conditional Woodville kids-with-main offer; Tuesday and Friday include Union only. **Only 1 of 7 days meets three distinct choices at both 18:00 and 19:00; target was 5 days.** Woodville's child eligibility and two venues' image/profile gaps mean this is schedule coverage, not three uniformly complete general-diner choices.

Every excluded offer and reason for all 28 cells is retained in [the full matrix evidence](data/local-pilot-dinner-coverage-2026-09-14.json); [compact CSV](data/local-pilot-dinner-coverage-2026-09-14.csv). Material exclusions:

- Union lunch: service already finished at dinner; booking capacity must still be checked for a future lunch. No live hold or booking was made.
- Reserve Social, Jimmy's and Harry's: actual offer/kitchen service hours unknown. Pub opening hours were not substituted.
- Cucina and Stella: source/date conflicts remain open. The more attractive interpretation was not selected.
- Canopy drinks, gallery/museum/garden activities and other non-meals: not dinner. National/distant offers: outside this pilot.
- Union specials on other days and Grand Junction/Woodville after Monday: wrong weekday.
- The engine separately retains starts-later, expired, insufficient freshness, unresolved booking, finished service and business-excluded reasons. Not every possible reason occurs in this particular 28-cell snapshot.

Existing evidence-age safeguards remain. New recurring Union/Woodville schedules have no invented offer expiry. Legacy internal review bounds were not represented as business-stated expiry dates or silently refreshed by an HTTP 200.

## B. Promoted and preserved priority offers

These nine priority rows cover the two new specials, six image-supported existing offers and the preserved Union lunch campaign. They are **four businesses, not nine**. Eight have explicitly documented catalogue-image rights in this pass; the existing lunch campaign is preserved separately. The unchanged source labels remain public-source labels except the established approved lunch campaign.

| Business / offer | Days / service | Main condition / action | Source / checked | Image rights | Location status | PerkDrop |
|---|---|---|---|---|---|---|
| Union Hotel — $25 parmi & pint — Monday and Tuesday | Mon/Tue 17:00–21:00; ongoing, no stated expiry | $25 combination; ask eligible pint options; no lunch-discount stacking. Confirm/order with venue. | [Supplied artwork](https://perkdrop.au/images/pilot/union-parmi.png); 2026-09-14 | Venue-supplied artwork; uncropped | 70 Waymouth St; existing pin retained | [Open](https://perkdrop.au/deals/union-parmi-pint) |
| Union Hotel — $28 Friday steak night | Fri 17:00–21:00; ongoing, no stated expiry | $28; cut/accompaniments must be confirmed; no drink inclusion promised. Confirm/order with venue. | [Supplied artwork](https://perkdrop.au/images/pilot/union-steak.png); 2026-09-14 | Venue-supplied artwork; uncropped | 70 Waymouth St; existing pin retained | [Open](https://perkdrop.au/deals/union-friday-steak) |
| Union Hotel — 20% OFF LUNCH ONLY | Mon–Thu 11:30–14:30; existing campaign | 20% off eligible food; drink purchase; excludes drinks/specials; party 1–6; 20 diners/service. PerkDrop booking-first; live capacity controls. | [Official menu + existing venue approval](https://www.theunionhotel.com.au/eat); 2026-09-07 | Existing approved campaign preserved; not newly re-cleared | 70 Waymouth St; existing pin retained | [Open](https://perkdrop.au/deals/union-hotel-20-off-lunch) |
| Art Gallery of South Australia — Free gallery entry and free exhibitions | Daily 10:00–17:00; general entry | FREE general entry; major exhibitions/events may cost extra. Visit; check separate exhibition tickets. | [Official AGSA page](https://www.agsa.sa.gov.au/visit/bookings-and-tickets/); 2026-09-14 | CC BY-SA 4.0 exterior; historical banner labelled | North Terrace, AGSA; existing pin retained | [Open](https://perkdrop.au/deals/pd-2026-0008-free-gallery-entry-and-free-exhibitions) |
| Art Gallery of South Australia — Monet to Matisse: Defying Tradition | Daily 10:00–17:00; exhibition ends 8 Nov | Adult timed ticket $30; flexi/concessions differ. Book timed tickets with AGSA. | [Official AGSA page](https://www.agsa.sa.gov.au/whats-on/exhibitions/monet-to-matisse-defying-tradition/); 2026-09-14 | CC BY-SA 4.0 exterior; not current exhibition imagery | AGSA, North Terrace; existing pin retained | [Open](https://perkdrop.au/deals/pd-2026-0072-monet-to-matisse-defying-tradition) |
| Art Gallery of South Australia — Monet to Matisse Friday Nights | Fri 17:30–20:30; admission ends 20:00; listed through 6 Nov | $45; online booking only; actual ticket availability at AGSA. Book online with AGSA. | [Official AGSA event](https://www.agsa.sa.gov.au/whats-on/exhibitions/monet-to-matisse-defying-tradition/monet-to-matisse-friday-nights/); 2026-09-14 | CC BY-SA 4.0 exterior; historical banner labelled | AGSA, North Terrace; existing pin retained | [Open](https://perkdrop.au/deals/pd-2026-0063-monet-to-matisse-friday-nights) |
| South Australian Museum — Free museum entry | Daily 10:00–17:00; holiday exceptions | FREE general entry; special exhibitions may cost extra. Visit; check special-exhibition tickets. | [Official museum page](https://www.samuseum.sa.gov.au/); 2026-09-10 (retained) | CC BY 2.0; entrance photo dated 2011 | Museum, North Terrace; existing pin retained | [Open](https://perkdrop.au/deals/pd-2026-0009-free-museum-entry) |
| Adelaide Botanic Garden — Free entry every day | September weekdays 07:15–17:30; weekends 09:00–17:30 | FREE daytime entry; selected events cost extra; October hours differ. Visit via official visitor guide. | [Official garden visitor guide](https://www.botanicgardens.sa.gov.au/visit/adelaide-botanic-garden/plan-your-visit); 2026-09-14 | CC0 entrance photo; dated 2010 | North Terrace garden entrance; existing pin retained | [Open](https://perkdrop.au/deals/pd-2026-0005-free-entry-every-day) |
| Adelaide Botanic Garden — Free daily guided garden walk | Daily 10:30–12:00; recurring volunteer-led walk | FREE; 5+ arrange booking; 36°C+ cancellation; no Good Friday/Christmas. Small groups meet at pavilion; 5+ arrange booking. | [Official garden walk page](https://www.botanicgardens.sa.gov.au/whats-on/free-guided-walks-adelaide-botanic-garden-2); 2026-09-14 | CC0 entrance photo; not a photo of the walk | Meet Schomburgk Pavilion; garden pin is not certified meeting-point guidance | [Open](https://perkdrop.au/deals/pd-2026-0006-free-daily-guided-garden-walk) |

Source verification and business approval are separate: Union supplied the original special artwork and approved the existing lunch campaign. AGSA, the Museum and Botanic Garden are public-source listings; their Creative Commons photography does **not** imply a commercial partnership, owner claim or approval of PerkDrop. No artificial regular price or saving was added. [Machine-readable row-level register](data/local-pilot-priority-offers-2026-09-14.csv).

Partially repaired / **not featured as complete**:

| Business | Offer / service | Evidence and condition | Remaining gap | Working destination |
|---|---|---|---|---|
| Woodville Hotel, 878 Port Road, Woodville South | Kids meal with purchased main; Mon 17:00–21:00 | [Official Monday event](https://woodvillehotel.com.au/event/monday-night/) plus [venue conditions](https://woodvillehotel.com.au/); checked 14 Sep; not public holidays | Kids age/menu eligibility and exact-branch photo rights unknown; existing pin retained; grade B | [Offer](https://perkdrop.au/deals/pd-2026-0059-woodville-hotel-kids-eat-free-mondays) |
| Grand Junction Tavern, 174 Grand Junction Road, Pennington | Buy one main/get one main free; Mon 17:00–21:00 | [Official offer](https://grandjunctiontavern.com.au/events/buy-1-get-1-free/); checked 14 Sep; excludes snacks, seniors/kids meals, entrees, toppers and public holidays | Photo rights, linked business profile and independently confirmed destination pin missing; grade A describes source only | [Offer](https://perkdrop.au/deals/pd-2026-0062-grand-junction-tavern-buy-1-get-1-free) |

Woodville's Tuesday schnitzel/Sunday roast and other possible specials remain leads, not new completed listings. Several offers at Union would not solve distinct-business coverage.

## C. Photos and maps

- **Catalogue:** 19 pilot image-bearing offers before; now 9 displayed images across 21 offers, plus 12 explicitly labelled placeholders. Eight current rows have documented reuse rights; one is the preserved lunch campaign. Nationally 33 of 45 show images after the 12 holds; this pass does not certify the other national images.
- **Directory heroes:** reported 2 before, 4 supported now: Union, AGSA, Museum, Botanic Garden. Union's former permission attribution did not cover its old hero; the hero is now the actual supplied exterior. Across the existing 33 active-offer businesses, missing rights-cleared heroes improve 31 → 29. The original “two cleared” label was not blindly accepted.
- **Fully completed pilot listings:** the ten-business target is not demonstrated. Four businesses now have supported directory/offer imagery and connected pages, but this is not ten fully reverified profiles. No new independent coordinate certification was obtained in this pass; the garden walk also needs exact meeting-point guidance beyond the garden pin.
- **Permission backlog:** 12 pilot offers are held and no longer featured/hot. Hijinx's prior Chermside image was wrong for Adelaide. None of these publicly reachable URLs is treated as permission.
- **Location backlog:** 77 public businesses still lack coordinates. No new coordinates or suburb-centre substitutes were written. Exact priority venues/addresses were checked against primary sites; existing destination points were retained. Grand Junction's correct address is Pennington; an address-search link alone is not point verification. Do not merge neighbouring tenants.

New assets all returned HTTP 200 with matching PNG/JPEG signatures, correct content types and successful mobile decode: supplied Union exterior 320×240 / 159,227 B; parmi 226×320 / 138,292 B; steak 226×320 / 134,622 B; AGSA 960×640 / 185,565 B; Museum 960×720 / 175,871 B. Supplied posters use contain/uncropped display; small heroes are not upscaled. Relevant alt text, fallbacks and attribution were checked on actual production pages.

[Photo credits and licences](../public/images/pilot/CREDITS.md): AGSA, Yu Chu Chin/Pangalau, CC BY-SA 4.0 (March 2026, old exhibition banner explicitly historical); Museum, David Hearle, CC BY 2.0 (2011); garden, Dinkum, CC0 (2010). These are real venue exteriors, not AI venue photographs or unrelated stock.

## D. Business onboarding — highest evidenced stage

| Stage | Evidence |
|---|---|
| Technical preparation | Complete for changed flow: exact preselection, verified email, authority evidence, persistent pending receipt, staff evidence review and clear first owner actions |
| Isolated email/Auth | **12 passing checks**, official Supabase Auth source commit 4eee58f296d9698a1c2c0ae14d7a0b379c7622d3; four messages captured by loopback SMTP only |
| Isolated portal UI | **15 passing mobile checks**, actual changed HTML with mocked transport; pending reload, duplicate-form hiding, recovery/expired link guidance and first actions |
| Consenting claim-pilot participant | **None evidenced**; three relationships below are not three agreed pilots |
| Real claim submitted | **0** in production |
| Staff approval / first real-owner access | **Not observed**; production memberships remain 0 |
| Production delivery | **Unproven**: approval notifications disabled/no sender; SMTP and redirect allow-list still need authenticated dashboard inspection |

The isolated real Auth server exercised signup, rejection before verification, verification, selected-business redirect, reused/expired links, recovery, new password and resend. Only the Unix listener option was changed to run official Auth on Windows. It is not a production delivery test. PostgreSQL tests separately enforce verified claimant **and** independent authority review, approved staff identity, exclusion checks and atomic single membership/outbox creation.

A queued approval notification is labelled **queued, not delivered**. No owner was impersonated; no production claim, membership, payment or offer was created for QA. Permitted listing/photo/offer changes still require a witnessed real-owner session; automated access checks are not that milestone. No actual completion time has been observed.

## E. Opt-outs and removals

Only the authorised PerkDrop Gmail connection was used and the mailbox identity was checked. Actual inbound context was read; quoted outbound footers, automated replies and delivery notices were not counted as human opt-outs.

| Measure | Result |
|---|---|
| Confirmed marketing opt-outs reconciled | **12** |
| Confirmed branch identities among those 12 | **6**: two existing public businesses plus four absent-business exclusion records |
| Existing businesses soft-delisted under owner policy | **2**; their public pages now 404 and directory/search/sitemap entries are absent |
| Explicit website/photo removal requests found and handled in scoped reconciliation | **0** |
| Delivery notices reconciled / suppressed recipients retained | **2**; one temporary inbox-capacity case reclassified, one permanent domain failure |
| Total suppression registry | **69**: unsubscribe 18, complaint 1, manual 10, invalid 40; 68 before |
| Unmatched opt-out branches awaiting private review | **6**; exact recipients remain suppressed |
| Ambiguous cases | **4**; no speculative business removal |
| Queued draft/approved outreach / newly blocked queued messages | **0 / 0** |
| Outstanding commitments flagged on these delistings | **0** |
| Unverified sending paths | External/manual Gmail sending and old exported lists; database guards do not prove these senders do an immediate pre-send check |

The 40 registry-invalid records were not all newly revalidated as permanent bounces. The two reviewed failures remain delivery suppression, not website-removal requests; temporary capacity failure is not a permanently invalid address. There is no automatic retry or alternate-address evasion.

The original stop-email wording stays private and unchanged; the separate policy basis explains delisting. Exact business IDs and confirmed name+address identities prevent reimport, including unlinked offers. No shared Gmail-domain or whole-franchise blanket rule was added. Private bookings/ownership history are preserved. Private ledger RLS is enabled; anon and authenticated SELECT are denied.

Unsubscribe GET/HEAD now render a no-tracking confirmation, with deliberate POST applying policy. An old GET event remains ambiguous because mail scanners can follow links. External search engines and past third-party social posts were **not** claimed removed.

## F. Production and testing

Runtime implementation **d921b184a8e89be9e5bf8cdc3b0341678a0a2ebe**, released by the existing GitHub main → Vercel workflow after local and protected-preview checks. Verified production deployment **dpl_DNUeecSjJ9yYoScTPZNcX6CpsvWw**, READY, with the matching commit; perkdrop.au served the v33-local-pilot assets. A subsequent evidence-only closeout commit records this report, data snapshots, runner corrections and the migration filename aligned to the applied ledger. Its exact production SHA is recorded in the final delivery message.

Applied production migration: **20260914110110_owner_publication_policy**. Authenticated Supabase deployment succeeded; no “CLI unauthenticated” stop. Active functions: catalogue-api v22, claim v6, admin-commercial v11 (JWT verification retained), portal v18, business-directory v9, unsubscribe v4, listing-reports v2.

| Verification environment | Result |
|---|---|
| Local exact-lockfile build / lint | PASS, Next 16.3.3; no dependency lock change |
| Seven changed Edge Functions | Deno typecheck PASS |
| Isolated PostgreSQL | **51 checks PASS**, including concurrent capacity, ownership and policy regressions; no production fixtures |
| Automated suites | Availability 12, inline scripts 2, discovery 7, analytics 1, saves 2, model harness 10 assertions: PASS |
| Local and production smoke | **34 route checks each PASS**; expected 404 exclusions checked |
| Isolated Auth / portal UI | 12 / 15 PASS, not real-owner evidence |
| Protected preview | READY d921b18; selected-time mobile layouts and unsubscribe GET confirmation inspected |
| Production pilot browser | **197 checks PASS**, all 21 pilot offers individually plus one nationally expanded Bunnings result; image/fallback decode, search → offer → linked profile → map/directions, supplied poster fit |
| Mobile layouts | 320–1280 px selected-time checks; production claim preselection across eight viewports; no horizontal overflow, blocking overlay or undersized tested controls |
| Public/private boundaries | Removed pages 404, directory/search zero, sitemap exclusions and no-store; unauthorised admin/claim-report reads denied; private ledger read denied |

The first data transaction was rejected by the existing publish-readiness guard because new specials needed cuisine/venue type. It rolled back; the reviewed patch supplied the required fields and then committed. No guard was weakened. Before-row rollback data is retained privately in the ignored audit directory. No destructive deletion was used. Browser-runner selector/navigation corrections and the migration filename alignment are included in closeout.

Existing crons and execution history were inspected: booking/capacity/operational jobs run, while an HTTP enqueue is not proof of downstream delivery. Social cron remains inactive. No demonstrated primary-source catalogue-maintenance automation was found. No new scheduler or paid service was enabled.

## G. Specific human handoff — drafts NOT SENT

### Three relationship-based candidates — drafts NOT SENT

There is **no evidence of three consenting owner-claim participants**. Do not report these three relationships as three agreed pilots or schedule contact automatically.

| Candidate / existing link | Evidence and current stage | Specific next step / blocker |
|---|---|---|
| [Union Hotel](https://perkdrop.au/claim?merchant=union-hotel-adelaide) | Venue manager agreed to the lunch offer and supplied images on 7 September. Claim-pilot participation has not been witnessed. | Ask the authorised representative to volunteer for a witnessed claim. Verify their business-domain email and existing correspondence; confirm authority for this exact venue. |
| [Rub Massage Adelaide](https://perkdrop.au/claim?merchant=rub-massage-adelaide) | Director expressed interest but explicitly deferred until late October; no offer agreed. Existing private prospect is not a public claimable listing. | Respect the requested timing. Human must identify the exact existing branch and approve a listing before inviting. This link currently cannot complete public preselection. |
| [Escape Hunt Brisbane](https://perkdrop.au/claim?merchant=escape-hunt-brisbane) | Master franchisor conditionally open to a small trial, subject to redemption/no-show/dispute/data/terms answers. No trial agreement or owner claim yet. Existing private prospect. | Resolve those questions, choose Brisbane rather than silently including Perth, obtain explicit pilot consent, and review public listing readiness. |

Owner instruction draft: “If you choose to take part, open your exact business link, confirm the prefilled venue, create/sign into your own account and verify your email. Briefly explain your authority and how staff can independently confirm it. Submit and retain the pending reference. No offer or payment is required to request ownership.”

Staff checklist: confirm exact branch; check suppression/removal history first; compare verified email and authority evidence with independent primary information; do not accept verified email alone; check existing owners; record review reason and evidence; approve atomically; inspect the outbox and actual provider delivery separately; witness the owner's own first sign-in; verify permitted listing/photo/offer edits with no live publication. Record start/end time only when observed. No completion time has been measured.



### Permissions, service evidence and private review

1. **Photo permission, exact branch and scope:** Woodville Hotel (Woodville South), Grand Junction Tavern (Pennington), Reserve Social, Jimmy's, Harry's, Canopy, Archie Brothers, Hijinx (Adelaide/Rundle Place, not Chermside), Cucina, Stella (Henley Beach), the currently listed OPSM branch and Rundle Mall's relevant listing. Request the nominated source file, right to licence it, attribution/cropping limits and separate offer-card/detail versus directory-profile/map permission. Do not reuse an old source URL merely because it loads.
2. **Terms:** ask Woodville which children/eligible kids meals qualify; ask Reserve/Jimmy's/Harry's exact kitchen hours for the named special; ask Cucina/Stella to resolve the preserved weekday/expiry conflicts. Union: confirm current pint options and steak plate details before making any additional claim.
3. **Locations:** independently confirm Grand Junction's destination point and link its exact existing business/profile after duplicate/suppression checks. Verify the Botanic Garden walk's Schomburgk Pavilion meeting point rather than using the entrance pin as walking directions to it.
4. **Private decisions:** match the six remaining opt-out branches without guessing. Review the four ambiguous cases: legacy GET-only unsubscribe, a polite participation decline, an in-house-marketing decline and a private-club eligibility response. Preserve suppression already applied; delist only on adequate business-level evidence. Two delivery failures also need branch matching if a linked business is later identified.
5. **Production Auth:** sign into the Supabase dashboard for the existing project to inspect SMTP and allowed redirects. Identify/approve the real notification sender before enabling delivery. Deployment access already works; this missing authenticated dashboard session concerns the remaining Auth settings inspection. No password or API key needs to be pasted into chat.
6. **Real participant:** seek Union's authorised representative's explicit agreement to the witnessed claim exercise. Rub Massage requested late October; do not contact early or treat it as consent. Escape Hunt Brisbane needs its operational questions answered and explicit participation agreement first. No invitations or reminders were sent or scheduled.
7. **Outreach:** before any future authorised send, verify the actual sender performs recipient AND business checks immediately before sending. Do not release exported lists until that path is demonstrated.

Photo request draft: “May PerkDrop display an image you nominate of your exact branch on its offer card, offer page, business profile and map? Please identify the files, confirm you can license them for those uses, and specify attribution or crop restrictions. If permission is offer-only, please name the offer. We will not infer permission from a public website.”

Service-window draft: “For [named offer] at [exact branch], please confirm the eligible days, the actual kitchen/offer start and finish time, required purchase, exclusions and any end date. We currently show the unresolved point rather than substituting your general opening hours.”

Union claim-pilot draft: “Would an authorised representative like to volunteer for a witnessed claim of your existing Union Hotel listing? No offer creation or payment is needed to request access. You would use your own account and verification email; staff would review your authority before granting access. We have not started or submitted a claim for you.”

Repeatable staff review: open the existing private queue → choose the specific issue category → read the primary terms/actual inbound request → check exact branch and suppression → confirm price, purchase, day/time, expiry and photo scope → retain contradictions → update last-checked only after substantive review → record resolution reason/evidence → verify public outcome and preserved commitments. Never close an item merely because this code shipped.

## Final outcome answers

**Can a new visitor in the pilot area now find several useful, trustworthy choices for an actual planned outing? PARTLY.** There are genuine free/daytime options and limited dinner specials, with explicit conditions and better photo evidence. Eleven source-usable businesses are not eleven complete profiles; dinner reaches three schedule-eligible businesses on only one of seven days.

**Has a real business owner successfully completed claiming and first access? NO.** Isolated Auth/UI/database preparation passed, but there are no production claims or owner memberships, no evidenced consenting participant for this exercise, and no witnessed first access or production email-delivery proof.
