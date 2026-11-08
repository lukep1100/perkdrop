# PerkDrop store listing — en-AU release candidate

App name: PerkDrop
Apple subtitle: Local deals worth knowing
Google short description: Find local offers, events and things to do across Australia.
Suggested category: Lifestyle; final selection must match store review.
Support: https://perkdrop.au/app-support
Privacy: https://perkdrop.au/privacy
Deletion information: https://perkdrop.au/delete-account
Contact: perkdropofficial@gmail.com

Structured, length-checked Apple copy is in `app-store.en-AU.json`. It is a preparation file, not a submitted App Store Connect record. Unverified signing/build IDs and screenshots intentionally remain empty.

## Full description

Know what’s worth doing before you make plans.

PerkDrop brings local offers, events, food, experiences and family activities into one place. Choose a suburb or postcode, use Near me, or browse across Australia. Explore current listings and verified date filters, check the price and conditions, then open the official source or directions.

See offers grouped by place, save useful finds and share a public listing with friends. Connect your own devices with a private one-time link to use the same saves, plans and passes. Add an outing to the website planner and export it to your calendar.

Where a business supports a PerkDrop claim, check its availability and conditions before claiming. Not all listings support booking or claiming in the app. A listing is not a booking confirmation.

Listings, dates and availability can change. Always check the current source, booking requirements and any exclusions before you go. Cached offline listings are labelled and cannot issue claims.

## Apple promotional text

Food, events, experiences and genuine local perks — before you make plans.

## Apple keywords

deals,events,food,activities,experiences,local,family,offers

## Review notes

Browsing does not require login. Private saves/plans/passes use a guest device credential. Location is requested only after tapping Near me; manual area search is available after permission denial. Map and current website details use an embedded WebView; the planner opens through explicit device pairing. In-app claims appear only for genuinely eligible, available offers; do not expect a claim button on every listing.

Settings includes Delete PerkDrop data with typed DELETE confirmation. It removes private account content and linked-device access; existing external bookings are not cancelled. Do not create or redeem a live merchant claim merely to demonstrate the UI; use an approved isolated review fixture if required.

Remote push is disabled in the committed release candidate. The Updates tab says so. Do not advertise push delivery in the listing or screenshots for a push-disabled build. No ads SDK, in-app payments, subscriptions or paid consumer tier is configured in this native build.

## Data disclosure working inventory — not completed store answers

- App functionality: guest device credential (stored in SecureStore; server stores its hash), saved items, private plans, connected devices and eligible claim/pass records.
- Analytics: pseudonymous installation/browser identifier, separate visits, interactions, platform/OS, first-tracked-open and bounded campaign tags. First tracked open is not verified App Store/Play installation. Production/QA traffic have separate labels.
- Location: foreground permission only; coordinates used for local filtering and rounded to three decimals for local persistence and map URL. The coordinate passed to a map/website provider must be included in the disclosure review; do not claim all location stays on-device.
- Offline cache: public catalogue only, up to 24 hours. It contains no private passes or credentials. Clearing it does not delete private saves.
- Optional push-capable builds: Expo push token, consent, selected city/timezone, limited delivery history, and provider processing through Expo/APNs/FCM. Currently disabled; final binary/actual configuration controls the store answer.
- WebView/external destinations: website request, referral and third-party processing can occur under their policies.
- Deletion: native Settings removes private account content and account-linked notification registration after server confirmation. Necessary transaction evidence can remain without account/session/pass-reference links. Technical logs/analytics are a separate retention category; do not state that all historical logs are erased by this action.

## Screenshots to capture from the release candidate

Discover; manual Near Me/area selection; family/free filters with accurate live results; map; listing details; saved items. Use genuine current inventory and truthful feature captions. Exclude private pass codes, device links and personal data. Capture required store/device sizes from the actual app, not a generated marketing mock-up, and verify against the signed build. The existing feature graphic is not a substitute for screenshots.

## Owner/store gates

Apple membership/signing/2FA and Google account verification/testing are not completed by these files. Confirm identifier ownership, genuine provider credentials, privacy/support/deletion pages LIVE at their published URLs, content rating, app privacy/data safety, required tests and final binaries before submitting.
