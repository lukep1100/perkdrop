# Easier PerkDrop discovery — 8 November 2026

## Evidence and scope

Studied EatClub’s public venue browser, open filter panel and Ca De Vin detail page in a browser, plus its current published app workflow. No signed-in EatClub native app, redemption or payment was tested.

Primary references: https://eatclub.com.au/venues, https://eatclub.com.au/venue/ca-de-vin, https://eatclub.com.au/terms?isWebView=1.

The public browser combines a search field, nearby control and one filter panel. Cards lead with a venue photo and an actual discount. A venue detail puts today’s offer and arrival window ahead of secondary information. Current terms describe venue-created spare-capacity offers followed by redemption and payment using the EatClub Card. The card, automatic bill discount and venue-controlled inventory are commercial/payment infrastructure, not visual features that can be reproduced by restyling PerkDrop.

## Implemented pattern

- Native Explore opens on search, compact quick plans and the actual venue list. The former large intro, always-open radius block and multiple recommendation rails no longer precede the first offer.
- One native filter sheet combines distance, date, category and family needs. Draft changes have a real unique-place count, apply together and can be dismissed without changing the list. The map retains its visible radius slider and shaded circle.
- Each venue card has one primary offer, a supplied value, distance, source-backed schedule and a separate save control. Other offers at the same exact branch appear in detail.
- Native detail keeps a primary action visible while reading. It opens the source directly for public listings, routes booking-required items to the venue and claims only live pass inventory. Offline, expired and sold-out claim states fail closed.
- Web discovery uses the same compact hierarchy and value/action semantics, with a single filter disclosure, direct offer cards and a persistent source action. Map links preserve selected category/date/plan filters.
- Existing brand, approved photos/credits, source checks, branch identity, expiry, explicit search widening, private saves, pass confirmation and notification consent remain in place.

## Acceptance and next priorities

Automated checks plus 390-pixel browser rendering cover UI and data/action contracts. Browser rendering is not acceptance on a physical iPhone. Verify the latest TestFlight build on a real device before public submission and replace store screenshots with that native UI.

The most important remaining product investment is dense, merchant-approved local inventory with exact service windows and cleared venue/food photos, starting with the target Adelaide/northern-suburbs market. Measure first offer open, source/claim completion, saves and return visits using existing internal-traffic exclusions before adding more panels. Do not imply a public-source promotion can be redeemed in PerkDrop or invent available stock, ratings, discounts or exclusive relationships.
