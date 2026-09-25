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

The app requests foreground location only after Near me is tapped. Native saves and passes use an anonymous, device-held credential. They will not automatically appear in the website's separate browser identity. The current app does not include remote push delivery.

## Release

Set up an Expo account and link this project with EAS before building. Confirm control of `au.perkdrop.app` in Apple Developer and Play Console, then create signed preview builds with `npx eas-cli@latest build --profile preview --platform all`. Test on physical devices. Store description, review notes and disclosure inventory are in `store/STORE_LISTING.md`.

After sign-off, create production builds using `npx eas-cli@latest build --profile production --platform all`, submit to TestFlight/Play testing, capture genuine app screenshots from the signed builds, complete store questionnaires and submit for review. Do not mark the app released until Apple and Google approve their respective listings.

The app and store publication need separate accounts and signing credentials. The Expo project ID, signing certificates, store listings, device tests, screenshots and push delivery are not configured in this repository yet.
