# PerkDrop App Store release runbook

Status: iOS source is prepared, production web deployment is live, and App Store public support/privacy/delete pages exist. The remaining gates are Apple account, signing, screenshots, TestFlight upload and Apple review.

## Native target

| Field | Value |
| --- | --- |
| App name | PerkDrop |
| Bundle ID | `au.perkdrop.app` |
| Platform | iPhone |
| Version | `1.0` |
| Build | `1` |
| Production URL | `https://perkdrop.au` |
| Support URL | `https://perkdrop.au/app-support` |
| Privacy URL | `https://perkdrop.au/privacy` |
| Delete-data URL | `https://perkdrop.au/delete-account` |

The iOS app is a Capacitor shell around the live PerkDrop product with a local offline fallback. Location permission is optional and used only after the user chooses nearby browsing.

## Local commands

```bash
npm ci
npm run lint
npm run build
npm run test:app-store-public
npm run mobile:sync:ios
npm run mobile:open:ios
```

## Apple Developer setup

1. Finish Apple Developer Program payment and account activation.
2. In Apple Developer, create or confirm the explicit App ID `au.perkdrop.app`.
3. Enable only the capabilities PerkDrop actually uses. Do not enable push, Associated Domains, Sign in with Apple or payments until the matching production service is configured and tested.
4. In Xcode, open `ios/App/App.xcodeproj`, select the PerkDrop team, and let Xcode manage signing.
5. Build on a real iPhone before archiving.

## App Store Connect listing

Suggested metadata:

| Field | Draft |
| --- | --- |
| Name | PerkDrop |
| Subtitle | Deals worth knowing about |
| Primary category | Lifestyle |
| Secondary category | Food & Drink |
| Promotional text | Find food, events, free plans and genuine local perks before you decide where to go. |
| Description | PerkDrop helps you find local deals, events, free things to do and places worth checking before you make plans. Browse by city, search nearby, save options, open directions and check the source before you book or travel. |
| Keywords | deals,events,food,Adelaide,things to do,local perks,free events |
| Support URL | `https://perkdrop.au/app-support` |
| Privacy URL | `https://perkdrop.au/privacy` |

Review notes:

```text
PerkDrop does not require an account to browse. Location access is optional; reviewers can deny it and use the city/search/map browsing flows. The app opens public local deals, events and venue information from https://perkdrop.au. Some listings link to third-party venue or organiser websites for booking or confirmation.
```

## Privacy questionnaire guardrails

Do not claim "Data Not Collected". PerkDrop may process:

- Location, only when the user grants location permission for nearby browsing.
- Identifiers and usage data for analytics, saved preferences, abuse prevention and service improvement.
- Contact information if a user emails support or submits a business/contact form.
- User content or support content if users submit reports, business information or support requests.
- Diagnostics or logs for service reliability.

Because PerkDrop can show bars, drink specials or licensed venues, answer the age-rating questionnaire honestly for alcohol references instead of selecting a no-alcohol default.

## Screenshots needed

Capture real iPhone screenshots after a TestFlight or local Xcode install:

1. Home discovery screen with premium rails.
2. Food & drink category rail.
3. Map view.
4. Place page with multiple offers at one venue.
5. Deal detail with conditions and source/directions action.

Use real production data only. Do not use fake deals, fake venue claims or unapproved venue photos.

## Submit path

1. `npm run mobile:sync:ios`
2. Xcode: Product -> Archive.
3. Distribute App -> App Store Connect -> Upload.
4. Wait for processing.
5. Add screenshots, privacy answers, age rating, support/privacy URLs and review notes.
6. Submit to TestFlight first.
7. Run device QA: launch, location denied, location allowed, search, map, save, directions, offline/retry.
8. Submit for App Review.

## Current external blockers

- Apple Developer Program must be paid/active.
- App Store Connect app record must be created under the correct Apple account.
- Signing requires the Apple team in Xcode.
- App Store screenshots require a real simulator/device capture from the signed app.
- Apple review can still reject a web-wrapper app under minimum-functionality rules if live supply, native polish or data quality is weak.
