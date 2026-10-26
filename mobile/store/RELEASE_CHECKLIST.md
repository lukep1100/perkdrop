# PerkDrop 1.0 — release evidence checklist

Prepared 29 September 2026. This checklist is intentionally evidence-based. An unchecked item is not implied complete because source code or a CI bundle exists.

## A. Automated engineering evidence

- [ ] Exact app commit recorded; current branch and locked packages reproduce.
- [ ] All mobile pure tests pass.
- [ ] Expo Doctor passes and both iOS/Android bundles export.
- [ ] Both native projects generate successfully.
- [ ] Android native compilation completes; record its revision and test-signing status.
- [ ] Existing web tests/build and old/new Edge type checks pass.
- [ ] Original database regression suite and new native service checks pass in an isolated cluster.
- [ ] New backend schema/functions deployed and versions independently read back; no migration replay.
- [ ] RLS and service-only notification/deletion access verified.

## B. Signing and store accounts — owner/external gates

- [ ] Apple Developer membership active; required 2FA, identity and signing access complete.
- [ ] Correct `au.perkdrop.app` App ID and App Store Connect app record confirmed.
- [ ] EAS access approved; no reuse of revoked credentials and no OAuth-scope bypass.
- [ ] Current iOS store-signed binary processed in TestFlight.
- [ ] Google Play developer account, required security/identity/physical-device verification complete.
- [ ] Current Android store-signed AAB accepted in the appropriate test track.
- [ ] New personal-account closed-testing requirement, if applicable, actually completed; production access granted.
- [ ] Current platform build requirements and target SDK checked from generated binary/store console.

## C. Physical device acceptance — do not substitute bundle export

Record phone model, OS, app version/build, commit, steps and result for each platform.

- [ ] Clean install, first open, cold/warm restart and interruption recovery.
- [ ] Manual suburb, near-me permission allowed/denied/revoked, Australia-wide switch.
- [ ] Readable small-screen and large-text layouts, safe-area insets, keyboard dismissal, tap targets and scroll rails.
- [ ] Discover/date/category/family filters use valid current listings and truthful empty states.
- [ ] Detail modal and current-web-details transition; Android back and iOS dismissal return correctly.
- [ ] Save/unsave/restart; network error does not claim the save succeeded.
- [ ] Map pins/directions/external official links; browser return; offline recovery.
- [ ] Private device pairing, rejection, expiry, revocation and cross-device isolation.
- [ ] Guest deletion on a dedicated test identity removes its own data only; unverified response does not clear access.
- [ ] Public share link contains no secret or private pass information.
- [ ] Universal/App Link fresh install, app closed and app open; missing/expired listing safely handled.
- [ ] Claims/passes only where genuinely supported; isolated fixture for consuming capacity; no fake merchant transaction.
- [ ] Tracking separates preview/public and excludes known owner tests.

## D. Domain association and optional push

- [ ] Real Apple App ID prefix and real Play app-signing fingerprint configured on the website.
- [ ] Both association endpoints deployed and return valid HTTP-200 JSON for those exact signing identities.
- [ ] Signed devices actually open the correct HTTPS listing in-app.
- [ ] Notification service, client permission, APNs/FCM credentials and Expo project association tested.
- [ ] Explicit opt-in only; denied permission keeps browsing usable.
- [ ] City, quiet hours and weekly cap; opt-out, device revocation and token invalidation tested.
- [ ] Closed-app receive/tap, expired-notification rejection and provider receipt evidence captured.
- [ ] Any unknown provider-send outcome reconciled before retry; no duplicate delivery claims.
- [ ] Enable flags changed only for the tested release; no automatic campaign/cron added without approval.

Push is optional for initial store submission. A push-disabled V1 must not advertise push features. A push-enabled launch requires the above evidence.

## E. Public launch

- [ ] Live privacy, support and deletion pages match final binary and actual service providers.
- [ ] Genuine signed-app screenshots prepared in store-required sizes with no private information.
- [ ] App privacy/data safety, age/content rating, contact and export-compliance answers reviewed.
- [ ] TestFlight/Play feedback resolved; release build measured on real devices.
- [ ] App review submission and approval evidenced independently for each store.
- [ ] Only then publish the consumer campaign with valid store links and track useful actions/return use.

Do not promise a release date or call the product 100% ready while any required gate lacks evidence. Preserve the free standard business model; do not introduce subscriptions, prizes, fees or marketing claims as part of release hardening.
