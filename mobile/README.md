# PerkDrop mobile

This is the iOS and Android consumer app in Expo SDK 57. It reads the live catalogue and uses PerkDrop's existing marketplace service for saved offers, claims, passes and in-app updates. The Map tab shows the live PerkDrop map within the app.

## Local checks

```bash
cd mobile
npm ci
npx expo-doctor@latest
npx expo export --platform all --output-dir dist
npm start
```

The app requests foreground location only after Near me is tapped. Native saves and passes use an anonymous credential in SecureStore. Explicit single-use links connect the same saved items, plans and passes to another device without signing out the original. Links expire after ten minutes. Email recovery is not enabled. The current app does not include remote push delivery.

## Release

This repository is linked to the existing Expo project `luke1100s-team/perkdrop` (`3e46f3cc-15c9-40d2-8a4a-6a0c93d977b3`). Confirm control of `au.perkdrop.app` in Apple Developer and Play Console, then create signed preview builds with `npx eas-cli@latest build --profile preview --platform all`. Test on physical devices. Store description, review notes and disclosure inventory are in `store/STORE_LISTING.md`.

After sign-off, create production builds using `npx eas-cli@latest build --profile production --platform all`, submit to TestFlight/Play testing, capture genuine app screenshots from the signed builds, complete store questionnaires and submit for review. Do not mark the app released until Apple and Google approve their respective listings.

The app and store publication need separate accounts and signing credentials. An earlier internal Android APK exists; it does not certify this revision. Apple signing/payment, Google Play account prerequisites, physical-device tests, final screenshots and push delivery remain external release gates. No active Expo CLI session or signing secret is stored here.

## Audit implementation — 25 September 2026

Web and native import the same date, cost, distance and venue rules. Explore adds verified date filters, manual suburb/postcode selection, explicit Australia-wide browsing and evidenced family budget/age filters. Add to plan opens the web planner through an explicit private device connection. Preview builds mark analytics as internal.

Selected areas persist locally. GPS points are rounded to three decimal places before local storage and the embedded map URL. There is no background location. A 30-minute visit is separate from the pseudonymous installation analytics identifier; neither counts people.

Expo Doctor 21/21 and iOS/Android bundle exports passed locally; cloud checks are recorded on PR #14. Physical installs, deep links and permission flows still need real devices. See `docs/audit-implementation-2026-09-25.md` for the coordinated release and remaining operational work.
