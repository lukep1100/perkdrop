# PerkDrop App Review response package — 15 October 2026

## Current Apple state

- Submission ID: `db9b9b8d-ca2e-48d6-8188-8bc843b04897`
- Submitted item: PerkDrop iOS App 1.0, build `1.0.0 (4)`
- Review result: **Rejected — Guideline 2.1, Information Needed (New App Submission)**
- Apple’s reason: the developer account has limited App Review history, so Apple requires more context before completing review. This is an information request, not a reported crash or functional defect.
- Newer TestFlight build: `1.0.0 (11)` is **Ready to Submit** for TestFlight. It is in the internal test group, but App Store Connect currently shows zero installs, sessions, crashes and feedback for that build.
- App Store product page: only one iPhone screenshot is currently attached. The screenshot set should be expanded with real in-app captures before resubmission.
- Account blocker: App Store Connect shows an updated Apple Developer Program License Agreement that must be accepted by the Account Holder before submitting an update.

## What Apple specifically requested

1. A screen recording from a physical device running the latest iOS, beginning with launching the app and showing a normal user flow.
2. A description of purpose, audience, problem and value.
3. Main-feature access/setup instructions, including demo credentials if required.
4. External services/platforms used for core functionality.
5. Regional differences, or confirmation of consistent operation.
6. Documentation/credentials for regulated services or protected third-party material, if relevant.

Apple asked for this information both in the App Review reply and in the **Notes** field of App Review Information.

## Draft Notes field

```text
PerkDrop is a public iPhone app for people in Australia who want to discover timely local food, events, free plans and venue offers before deciding where to go. It helps users browse by city or category, search, view a map, open a listing’s conditions/source, save options and open directions or an official venue/organiser link.

The main consumer experience needs no account, payment or subscription. No demo credentials are required. Location is optional and is only requested when the user chooses a nearby/map flow; reviewers may deny it and use city, category, search and map browsing normally. Merchant-only account flows are not needed to review the public consumer experience. The account-deletion page is https://perkdrop.au/delete-account.

Core services: PerkDrop uses Capacitor for the native iOS shell; Vercel hosts the public product and collects product-performance analytics; Supabase provides the PerkDrop database, server functions, analytics event collection and optional authenticated merchant workflows; OpenStreetMap tiles are used for the public map; Google Maps may open only when a user chooses directions. Listings may link to official venue or organiser websites for booking or confirmation. PerkDrop does not use in-app purchases, payments or AI services.

The app is intended for Australia. Content availability varies by city and participating/verified venues, but the core browse, search, map, save and external-link flows work consistently across regions. PerkDrop is not a regulated service. Public listing details link back to official sources; merchant submissions require authority and media-rights confirmations, and PerkDrop uses owned, licensed or authorised imagery (or neutral PerkDrop fallback imagery) for published listings. Supporting permission evidence can be provided on request.

Attached/linked for this resubmission: a physical-device recording from the current TestFlight build showing launch, public browsing, search/map, an offer/details screen, optional-location handling and opening a source/directions action.
```

## Draft reply to App Review

```text
Hello App Review,

Thank you for the guidance. We have added the requested information to the App Review Notes field and prepared the current TestFlight build for review.

PerkDrop’s consumer experience is public and does not require an account, payment or subscription. We have attached a recording captured on a physical iPhone running the current iOS release. It begins by launching PerkDrop and demonstrates the normal public flow: discovery browsing, search/map, viewing an offer with its conditions/source, optional-location handling, and opening directions or an official venue/organiser link.

The App Review Notes now describe the app’s purpose and audience, access instructions, external services, regional behaviour, and our approach to source and media rights. No demo account is required for the public consumer flow.

Please let us know if any further context would help complete the review.

Kind regards,
Luke Pranter
PerkDrop
```

## Physical-device QA and recording checklist

Use the current TestFlight build (`1.0.0 (11)`) on a real iPhone running the latest available iOS. Do not use a simulator recording or mock content.

1. Install build 11 from TestFlight, launch it once, and confirm it loads the current production site.
2. Run the following QA before recording: launch; deny location; browse a city/category; search; open the map; request location only from the explicit nearby control; open a listing; save/unsave a listing; open its source or directions action; test a short offline/retry recovery if practical.
3. Start iPhone screen recording on the Home Screen. Launch PerkDrop and keep the recording to roughly 45–90 seconds.
4. In the recording, show public discovery, a category/search result, map or nearby flow, one listing’s conditions/source, and one directions/official-link handoff. Do not show passwords, personal email, browser tabs, private merchant pages or unverified/unpublished content.
5. Stop the recording, review it end-to-end, then attach the MP4 in App Review Information. Keep the original file available until Apple approves the app.
6. Capture at least four additional real in-app App Store screenshots (home/discovery, category rail, map, listing/conditions, optional fifth save/source action). The existing product page only has one screenshot.

## Resubmission order

1. Account Holder accepts the updated Apple Developer Program License Agreement.
2. Complete the real-device QA and recording above using build 11.
3. In App Store Connect, replace build 4 with build 11 for version 1.0, add the recording attachment, paste the Notes text, and add the new real screenshots.
4. Save the version and send the prepared reply to App Review.
5. Review the saved content once, then resubmit. Keep the release setting as manual until approval.

Do not claim that device QA, the recording, the attachment, the new screenshots or build-11 selection are complete until they have actually been completed.
