# Adelaide local pilot and owner publication policy

Release preparation, 14 September 2026. This document is updated with production evidence after release; preparation is not a deployment claim.

## Scope and measures

Adelaide inner metro means a 12 km straight-line radius from Victoria Square (-34.9285, 138.6007). This is not walking distance and the origin is not a fabricated business pin. National architecture is unchanged. Count distinct merchant IDs (normalised business names for unlinked records), not repeated offer/location rows. The next seven local calendar days are 14–20 September 2026.

`local-pilot-coverage.mjs` reuses the public availability engine, retains the existing evidence-age rule, and records an exclusion for every row at 17:00, 18:00, 19:00 and 20:00. Currently recorded future schedules are not a guarantee that a source, table or booking remains available. Lunch, drinks-only and non-food activities are excluded from the dinner measure, not from appropriate daytime/weekend discovery.

Baseline: 309 public businesses; 43 active offers; quality A17/B7/C14/D5; 17 explicit service windows. In the pilot, the baseline dinner matrix contains one eligible business on Monday and zero Tuesday–Sunday at each of the four measured times. Baseline snapshots and the reviewed change plan are in `docs/data/`.

## Prepared supply and imagery

Two separate Union Hotel specials are sourced from original venue-supplied artwork: Monday/Tuesday $25 parmi-and-pint, and Friday $28 steak night, both 17:00–21:00. No regular price, steak weight, cut or extra included drink is invented. They do not use the lunch promotion's booking capacity or 20% discount. Merchant artwork and public menu sources are distinguished from formal owner claiming.

Woodville's official Monday event page resolves its service window to 17:00–21:00. The kids-menu eligibility details and photo permission remain unconfirmed, so it remains a conditional/incomplete listing rather than a fully completed pilot business. Tuesday schnitzel and Sunday roast leads are recorded but not added as complete promoted offers without photography permission.

Union's directory hero had incorrectly been attributed to an email that authorised different supplied images. Replace it with the actual supplied exterior; preserve the established lunch campaign separately. AGSA and the South Australian Museum receive relevant Creative Commons images, with attribution and historical-photo qualifications. Botanic Garden's existing CC0 asset is retained and credited. Unsupported pilot images are held, including Hijinx's wrong Chermside branch photo. Catalogue images and directory heroes are different coverage measures. Original source sizes are retained; no AI venue images or upscale claims.

Grand Junction's official address is Pennington, not Blair Athol. Its existing point is not newly certified by an address-only Google Maps search link; a linked directory profile and independently verified destination point remain a connected-journey gap. No suburb-centre pin or new paid geocoder was used.

## Technical owner journey

Isolated Supabase Auth built from official source commit `4eee58f296d9698a1c2c0ae14d7a0b379c7622d3`, with only the Unix listener option replaced for Windows loopback testing. Twelve real isolated Auth checks passed: signup, unverified-login rejection, verification, preserved selected-business redirect, reused/expired-link rejection, recovery, new password and resend. Four emails were captured by a loopback SMTP sink; none left the machine. This is not production SMTP proof.

Fifteen isolated mobile UI checks exercised the actual changed portal HTML with a mocked transport: pending receipt after reload, no payment/offer requirement, duplicate-form hiding, first owner actions, recovery and expired-link guidance. Database tests separately enforce verified-email-plus-authority review, staff identity, evidence, exclusions and one atomic membership/notification under concurrent approval. A queued notification is explicitly not a delivered email.

Production approval notification configuration was inspected: disabled, with no sender configured. Supabase dashboard sign-in is still required to inspect the production SMTP/redirect configuration. Deployment access through the authenticated Supabase connection is separate and available. No production owner, claim, booking or QA entitlement was created.

## Three relationship-based candidate handoffs — drafts, not invitations

There is **no evidence of three consenting owner-claim participants**. Do not report these three relationships as three agreed pilots or schedule contact automatically.

| Candidate / existing link | Evidence and current stage | Specific next step / blocker |
|---|---|---|
| [Union Hotel](https://perkdrop.au/claim?merchant=union-hotel-adelaide) | Venue manager agreed to the lunch offer and supplied images on 7 September. Claim-pilot participation has not been witnessed. | Ask the authorised representative to volunteer for a witnessed claim. Verify their business-domain email and existing correspondence; confirm authority for this exact venue. |
| [Rub Massage Adelaide](https://perkdrop.au/claim?merchant=rub-massage-adelaide) | Director expressed interest but explicitly deferred until late October; no offer agreed. Existing private prospect is not a public claimable listing. | Respect the requested timing. Human must identify the exact existing branch and approve a listing before inviting. This link currently cannot complete public preselection. |
| [Escape Hunt Brisbane](https://perkdrop.au/claim?merchant=escape-hunt-brisbane) | Master franchisor conditionally open to a small trial, subject to redemption/no-show/dispute/data/terms answers. No trial agreement or owner claim yet. Existing private prospect. | Resolve those questions, choose Brisbane rather than silently including Perth, obtain explicit pilot consent, and review public listing readiness. |

Owner instruction draft: “If you choose to take part, open your exact business link, confirm the prefilled venue, create/sign into your own account and verify your email. Briefly explain your authority and how staff can independently confirm it. Submit and retain the pending reference. No offer or payment is required to request ownership.”

Staff checklist: confirm exact branch; check suppression/removal history first; compare verified email and authority evidence with independent primary information; do not accept verified email alone; check existing owners; record review reason and evidence; approve atomically; inspect the outbox and actual provider delivery separately; witness the owner's own first sign-in; verify permitted listing/photo/offer edits with no live publication. Record start/end time only when observed. No completion time has been measured.

## Owner policy and repeatable review

Confirmed identifiable business marketing opt-out means recipient/business suppression **and** reversible soft-delisting under PerkDrop's publication policy. Keep the original stop-email request unchanged; do not claim it asked for website removal. Private bookings and memberships are retained and outstanding commitments are flagged. Exact IDs/branches prevent reimport; shared domains and other franchise branches are not blanket-matched. An old GET unsubscribe is not proof of a confirmed human submission: future GETs show a POST confirmation instead.

Delivery failure suppresses the recipient and linked business's alternate-address marketing, but is not a removal request. Inbox-full is not a permanently invalid address, even when that particular delivery receives an SMTP 550. Unmatched and ambiguous correspondence stays in the existing private review queue.

The private queue distinguishes reports, overdue source checks, source conflicts, missing service hours, photo permission, business authority and opt-outs. Closing an issue requires both reason and evidence. Review staff should: read the actual primary offer terms; compare price, required purchase, days/hours/expiry and branch; verify asset rights; preserve contradictory evidence; update the last-checked timestamp only after meaningful review; confirm the public result; record resolution evidence. An HTTP 200 alone is insufficient.

Existing cron execution records were inspected. Booking/capacity and operational jobs run; HTTP-enqueue success is not downstream email delivery. No independently demonstrated catalogue-content-review automation was found. Social publishing remains disabled. External/manual Gmail sending is unverified against database suppression and must not use old exported lists without a fresh business/recipient eligibility check.

Photo permission draft (not sent), for Woodville, Grand Junction, Reserve Social, Jimmy's, Harry's, Canopy, Archie Brothers, Hijinx Adelaide, Cucina, Stella, OPSM and Rundle Mall as applicable: “May PerkDrop display an image you nominate of this exact branch on its offer cards, offer page, business profile and map? Please identify the files, confirm you can license them for that use, specify attribution/cropping limits, and clarify whether permission covers directory use or only the named offer. We will not infer permission from a public website.” Hijinx specifically needs Adelaide/Rundle Place imagery, not Chermside. Missing service/eligibility terms need a separate precise question; no drafts have been sent.

## Release evidence

Pending final production verification. See the final section added after the GitHub → Vercel release and Supabase deployment.
