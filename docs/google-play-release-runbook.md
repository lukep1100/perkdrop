# PerkDrop Google Play release

Prepared 8 November 2026 for the current native React Native/Expo app, package `au.perkdrop.app`, version 1.1.0. Preserve the existing Expo project `luke1100s-team/perkdrop`, ID `3e46f3cc-15c9-40d2-8a4a-6a0c93d977b3`. Do not create a duplicate package/project or silently replace its existing Android upload key.

## Current account evidence

The official direct Play account setup route reaches Google's sign-in page. The saved Luke account is signed out. Current enrollment, payment, identity verification, app existence and production access cannot be verified until the owner signs in. Connected PerkDrop/personal Gmail searches found no Play registration receipt; absence of email is not proof that no account exists. Earlier project history records an Expo Android preview and an existing generated Android key, plus a blocked Google security challenge. No completed Play submission is evidenced.

The owner already authorised the US$25 Google registration fee on 7 October. Do not request that budget again. New legal agreements, credential changes and access grants still require the applicable secure owner interaction. Never inspect credentials, use a revoked Expo token, bypass a denied OAuth grant, publish identity documents or invent an organisation.

## Engineering and signing

- Android disables backups of private guest access and blocks unused storage, camera/microphone, media, overlay, advertising-ID, background-location and exact-alarm permissions. Optional foreground location remains available.
- Mobile CI now compiles the current Android APK and AAB for arm64 on relevant PRs and manual runs. It inspects the actual APK identity/version/target API, permissions, embedded JavaScript, backup/debug flags, public App Link and 16 KB ELF/ZIP alignment. API 36 is the minimum checked against Google's current new-app requirement.
- A requested QA artifact, if the job passes, is retained for seven days on this preparation branch or manual runs. Both filenames state `QA-NOT-FOR-GOOGLE-PLAY`. They use the generated test signing configuration. They are useful for engineering/device testing, **not Play upload**. Their certificate must never be used for the production assetlinks endpoint.
- `play-internal` and `play-production` EAS profiles explicitly produce an Android App Bundle. Internal analytics and public analytics are separate; both keep unverified Android remote push disabled. Submission profiles stay draft and do not roll out publicly.
- Restore approved owner access to the existing Expo account and check its build allowance before a cloud build. Reuse its existing upload key. Do not expose or commit it, generate a replacement without a confirmed need, or add service-account access without approval.

```sh
cd mobile
npx eas-cli@latest build --platform android --profile play-internal
```

Record the resulting signed AAB, actual versionCode, source commit and upload-certificate SHA-256. If submission automation is not already approved/configured, upload that bundle through Play Console. Current Expo Submit can also create a first internal release when the app and approved service-account credentials already exist; it is not necessary to grant new API access for a manual upload.

## Listing and required owner checks

Draft text is `mobile/store/google-play.en-AU.json`. Use PerkDrop branding and `perkdropofficial@gmail.com` for public product contact. Support, privacy and deletion links must be checked live. The Data safety worksheet is a source audit, not a completed questionnaire. Review final SDK/WebView behaviour, ads/placements and age/content rating before final declarations. Family activities are aimed at parents; do not claim the app is specifically designed for children or guess an IARC rating.

The store icon (512 x 512 RGBA PNG) and feature graphic (1024 x 500 RGB PNG) are prepared in `mobile/store/assets/`, with editable SVG sources using the existing brand system. Native Android phone screenshots must come from the real app; do not use iPhone screenshots, browser mock-ups or generated fake offers. Google's feature graphic is 1024 x 500, icon 512 x 512; screenshot/asset requirements should be checked at upload.

## Console sequence

1. Owner signs into the correct Google account. Check for an existing Play developer account/app before registration or Create app.
2. Complete any genuine owner-only security, agreement, payment, legal-identity and Android-device verification steps. A personal account's required legal identity can appear publicly; an organisation account requires a real qualifying organisation. Do not select an account type merely to avoid testing or identity rules.
3. Attach the correctly signed AAB to internal testing. Check Console warnings and pre-launch results; test the actual current app on Android, including system Back, safe-area/large text, manual area, location denial, filter Apply/Close, quiet-radius widening, map/source return, save/restart and optional permission behaviour. Do not consume real venue inventory for a test.
4. Finish accurate store listing, native screenshots, access instructions, content rating, Data safety and other app-content declarations.
5. For personal accounts created after 13 November 2023, complete Google's closed test with at least 12 genuinely opted-in testers continuously for 14 days, then apply for production access. Internal QA does not start or satisfy this clock. Do not fabricate tester evidence or production approval.
6. Once required approval is granted, review the production release and publish. Record an accepted Play version and verified public listing URL before calling it available on Google Play.
7. Configure `PERKDROP_ANDROID_APP_SIGNING_SHA256` only from the actual Play app-signing certificate, then verify the public assetlinks endpoint and signed-device HTTPS links. Do not confuse the upload certificate with Google's app-signing certificate.

## Primary references checked

- Google account setup: https://support.google.com/googleplay/android-developer/answer/6112435
- Closed testing: https://support.google.com/googleplay/android-developer/answer/14151465
- Current target API: https://support.google.com/googleplay/android-developer/answer/11926878
- Data safety: https://support.google.com/googleplay/android-developer/answer/10787469
- Preview assets: https://support.google.com/googleplay/android-developer/answer/9866151
- Expo Android submission: https://docs.expo.dev/submit/android/
