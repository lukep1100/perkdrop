# PerkDrop native release candidate

Existing app, existing backend, one iOS/Android codebase. App identity remains `au.perkdrop.app`; EAS project remains `luke1100s-team/perkdrop` / `3e46f3cc-15c9-40d2-8a4a-6a0c93d977b3`.

## Implemented in the 29 September release work

- Five native tabs with a compact Explore flow, optional first-use area selection, manual location fallback, real catalogue and shared verified date/venue rules.
- Saved items, pass display, explicit private device pairing and website planner handoff remain supported.
- Time-bounded network calls and a labelled public catalogue cache; cached data cannot issue capacity claims. No private credentials or passes are cached in that file.
- Initial and warm link handling, strict owned-domain validation, public listing sharing and safe unavailable-listing fallback. Private pairing links never become public share links.
- Apple/Android domain-association configuration and fail-closed website endpoints. Their real signing identifiers are still required.
- Optional push client and separate private sender, explicit consent, weekly cap, quiet hours, expiry checks, receipts and opt-out. ALL committed build profiles keep remote push disabled. No scheduler or campaign is enabled.
- Guest-account deletion UI and owner-scoped backend service with typed confirmation. Linked private plans/saves/device access are deleted; necessary transaction evidence is retained without the consumer/session/pass-access link. External venue bookings are not cancelled.
- Settings, phone-permission access, support/privacy links, loading states and a root error boundary.
- Native first-tracked-open, OS and campaign metadata, plus separate visit/browser identifiers. These do not prove unique people or store installs.

## Local source checks

```sh
cd mobile
npm ci
node --test tests/*.test.mjs
npx expo-doctor@latest
npx expo export --platform all --output-dir dist
npx expo prebuild --no-install
```

The GitHub Mobile release checks workflow runs these checks and an Android native QA compilation. Generated native folders are ignored. No store signing or publication is implied by any CI success.

## Backend rollout order

1. Pass the isolated `node scripts/native-release-database.mjs` suite.
2. Apply `supabase/release/mobile-release.sql`, then `supabase/release/mobile-push-revocation.sql`, through the connected migration tool. Do not replay older production schemas.
3. Deploy `_shared/mobile-http.ts` with `perkdrop-mobile-device` (custom device-secret authentication; gateway JWT off), and `perkdrop-mobile-push` (service-only bearer verification; gateway JWT on).
4. Deploy the compatible `perkdrop-track` revision that preserves bounded `os`, `app_first_open`, `utm_content` metadata. Preserve all existing event aliases.
5. Verify RLS and service-only privileges, capabilities, denied credentials, and owner-device deletion without using real customer accounts as test fixtures.
6. Keep `PERKDROP_PUSH_ENABLED` unset/false and do not configure any schedule until actual signed-device delivery and opt-out testing is complete.

The existence of files is not rollout evidence. Record deployment versions and verification results in the PR before marking a backend item complete.

## Signing and real builds

No active Expo credential or signing secret is stored in the repository. Do not reuse the revoked earlier robot token or bypass the previously denied GitHub/Expo OAuth approval.

```sh
cd mobile
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile testflight --platform ios
```

These require the owner's approved EAS access and appropriate Apple signing. Running them can consume the owner's Expo build allowance; do not start without checking it. The `testflight` profile has store distribution but INTERNAL analytics, and is not the public launch profile.

After device sign-off, use the production profile for store release, then the correct Apple/Google testing/submission process. Do not automatically submit with a build command. Store accounts, fees, identity checks, signing and approval remain separate.

## Push activation is a separate gate

Required: correct Apple APNs and Android FCM credentials; private Android `GOOGLE_SERVICES_JSON` file for the build; an Expo access token stored only in the backend; verified endpoint rollout; reviewer-tested permission denial, opt-out, token expiry, invalid/expired links and closed-app delivery. Change both build/server enable flags only after this evidence exists. The server currently supports manually curated city event picks, not an autonomous nearby-deal recommendation engine.

## Public link activation

Set the real Apple App ID prefix in the website environment as `PERKDROP_APPLE_APP_ID_PREFIX`. Set the real Play APP SIGNING SHA-256 certificate as `PERKDROP_ANDROID_APP_SIGNING_SHA256` (comma-separated only for verified certificate rotation). Never substitute a debug certificate or an invented Apple Team ID. Deploy and verify both association endpoints return their correct JSON with HTTP 200. Until then HTTPS links may remain in the browser.

## Final release evidence

Follow `store/RELEASE_CHECKLIST.md`. Complete the native screenshots, privacy/data-safety and age-rating questionnaires from the actual signed binary, not a design mock-up. No arbitrary readiness percentage replaces these gates.
