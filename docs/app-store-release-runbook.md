# PerkDrop App Store release runbook

Status verified 8 November 2026: Apple approved iOS 1.0, build 11. The authorised manual release was accepted and App Store Connect shows **Ready for Distribution**, Australia only, for app ID `6820120968`. The Australian public lookup still returned zero results at the last check, so public download availability is not yet independently verified. App Analytics was unavailable; no install/download total is established.

The original account, signing, upload, screenshots and review gates were completed for the approved release. The instructions below are retained for future binary updates, not as current launch blockers. Do not resubmit the approved build merely to deploy website or development-tool maintenance.

Release record: https://appstoreconnect.apple.com/apps/6820120968/distribution/ios/version/deliverable

Australian public lookup: https://itunes.apple.com/lookup?id=6820120968&country=au

## Native target

| Field | Value |
| --- | --- |
| App name | PerkDrop |
| Bundle ID | `au.perkdrop.app` |
| Platform | iPhone |
| Version | `1.0` |
| Build | Approved release: `11`; local template: `1`. Future uploaded builds must exceed the latest accepted build. |
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

## Apple Developer setup for future updates

1. Confirm Apple Developer Program membership remains active. This was sufficient for the approved release.
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

## Screenshots for future listing updates

Capture real iPhone screenshots after a TestFlight or local Xcode install:

1. Home discovery screen with premium rails.
2. Food & drink category rail.
3. Map view.
4. Place page with multiple offers at one venue.
5. Deal detail with conditions and source/directions action.

Use real production data only. Do not use fake deals, fake venue claims or unapproved venue photos.

## Submit path for a future binary update

1. `npm run mobile:sync:ios`
2. Xcode: Product -> Archive.
3. Distribute App -> App Store Connect -> Upload.
4. Wait for processing.
5. Add screenshots, privacy answers, age rating, support/privacy URLs and review notes.
6. Submit to TestFlight first.
7. Run device QA: launch, location denied, location allowed, search, map, save, directions, offline/retry.
8. Submit for App Review.

## GitHub TestFlight upload path

The repo also includes a manual workflow: `.github/workflows/ios-testflight-upload.yml`.

Create a protected GitHub environment named `app-store-connect`, then add these secrets:

| Secret | Purpose |
| --- | --- |
| `APPLE_TEAM_ID` | Apple Developer Team ID for signing |
| `APP_STORE_CONNECT_API_KEY_ID` | App Store Connect API key ID |
| `APP_STORE_CONNECT_ISSUER_ID` | App Store Connect issuer ID |
| `APP_STORE_CONNECT_API_KEY_P8` | Full private `.p8` key contents |

After the App Store Connect app record exists for `au.perkdrop.app`, run the **iOS TestFlight upload** workflow manually. It runs the native config test, syncs Capacitor, archives the iPhone app on macOS, exports an IPA and uploads it to TestFlight. The workflow uses the GitHub run number as the iOS build number so each upload can be accepted as a new build.

## Checks before a future binary update

- Confirm membership, signing and the existing App Store Connect app record remain valid.
- If using GitHub TestFlight upload, confirm the four `app-store-connect` environment secrets above. Never store their values in this document.
- Build/archive on macOS with Xcode and complete real-device QA. Linux configuration tests do not replace a signed device build.
- Capture any replacement screenshots from the signed app, using real approved inventory.
- Submit a new binary only when its native changes require it; each new submission is subject to Apple review.
