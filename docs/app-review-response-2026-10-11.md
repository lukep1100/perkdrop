# PerkDrop — Apple review diagnosis and response draft

Inspected directly in the owner's signed-in App Store Connect account on 11 October 2026. This document is a draft and includes the native repair/signing progress log. No review reply, review metadata save, resubmission or customer-data deletion was performed. The repaired build has now uploaded successfully; Apple processing/group assignment and physical-device acceptance are being verified separately.

## Current release status — 11 October 2026

The historical progress entries below describe earlier states. This section supersedes them.

| Stage | Confirmed current state |
| --- | --- |
| Native repair | Filter sizing is repaired in source. Venue-card image selection and source/licence links are also saved on `fix/ios-filter-sizing-20261011`, commit `7de19b46288bc6d68d622e09e9baeadbb57591ca`. Neither change has been verified on a physical iPhone. |
| Verification | All 73 mobile tests pass, including 15 new image/credit tests. iOS JavaScript/Hermes export succeeds: 681 modules, approximately 1.7 MB. `git diff --check` passes. This is not a signed native build or device QA. |
| Apple signing | With the owner's explicit signing approval, Apple issued a distribution certificate expiring 11 October 2027 and an App Store profile for `9RUYYFS5NJ.au.perkdrop.app`. The downloaded profile matches the generated private key/certificate, has associated domains and no APNs entitlement, and is not a development profile. Existing certificates/profiles were not revoked or changed. |
| Expo setup | GitHub remains connected with `/mobile` as base directory. The encrypted certificate attachment/password were accepted at credential-wizard step 4, but the credentials have not been finalized. The correctly named `.mobileprovision` upload at step 5 was repeatedly rejected by the cloud-browser permission control as declined, despite the owner's chat approvals. No workaround or alternate upload mechanism was attempted. |
| Build/upload | Native build `1.0.0 (9)` compiled, passed archive inspection, exported with Apple distribution signing, passed final signed-IPA checks and uploaded successfully with no errors at 20:38:50 UTC on 11 October. Corrected run `38172753214` is SUCCESS, pinned to repair-branch commit `4db4b5772e5eb4b0b096b1a331a26d993e280198`. It includes filter/media repair `7de19b46288bc6d68d622e09e9baeadbb57591ca`. No EAS build was started. |
| Website app links | Production now defines the Apple App ID prefix confirmed from Apple's signed build. Deployment `dpl_5iN2AW7vBPJpNdNwJoi17VK2do6j` is READY and serves the same website source `12731026d58acea5efe3595fcd150564abf3ee59`. The previously failing Apple association endpoint now returns HTTP 200 JSON for `9RUYYFS5NJ.au.perkdrop.app`, limited to public `/deals/*` links. A physical-device universal-link opening has not been demonstrated. |
| Apple evidence | The six-part reply/Notes draft and recording guide remain prepared but unsent. A new complete physical-device recording of the actual selected repaired binary and applicable image permission evidence are still required. |

Signing material is kept out of this report, repository commits, screenshots and downloadable artifacts. The encrypted signing bundle has only been attached to the expressly approved Expo wizard; no final credential-save success is claimed.

### Independent Apple CI build route

The existing `iOS TestFlight upload` workflow on `main` successfully archived, exported and uploaded legacy build 4 on 10 October (run `38016523057`). Its existing `app-store-connect` environment already contains the owner's Apple API key/team configuration. A native version of that same workflow path has been saved on the repair branch only; the production branch and legacy workflow were not overwritten.

The workflow uses the existing environment without creating an API key, changing access permissions, copying secrets into the repository, or uploading the browser-denied Expo profile/P12 by another mechanism. It generates the Expo iOS project on macOS 26, compiles the iPhone archive, checks embedded JavaScript and privacy manifests, exports with existing Apple automatic signing, verifies signed entitlements, and only then uploads to TestFlight. It does not retain a binary or credential as a GitHub artifact. The temporary API-key file is removed in an always-run cleanup step.

First run `38123255472` passed compilation, archive inspection and Apple distribution export. Its final check found that the exported IPA had lost the associated-domain capability from the unsigned archive; the upload was correctly skipped, and cleanup succeeded. The corrected workflow retains the reviewed source entitlements in a temporary ad-hoc archive signature before Apple's actual distribution export. This temporary archive is not distributable. All final signed-IPA checks remain mandatory, including correct team/application identity, disabled development debugging, no APNs and the associated domain. Corrected run `38172753214` started on the exact workflow-fix commit; build 9 was not consumed by the first attempt.

The corrected run has now completed successfully. The archive uses iOS SDK 26.5 and contains embedded production JavaScript plus 10 parseable privacy manifests. Final distribution signature verification, bundle/build identity, correct Apple team/application identity, `get-task-allow=false`, no APNs and `applinks:perkdrop.au` all passed. Apple upload returned `UPLOAD SUCCEEDED with no errors`. Temporary API-key cleanup also succeeded. This is upload evidence; Apple processing, tester availability, physical-device flows and store approval are distinct checks.

Build 8 is currently the highest available build in App Store Connect, so this candidate is build 9. If Apple accepts an upload, never rerun with the same number; use a higher unused number for subsequent candidates and align the EAS remote build counter before returning to EAS. Successful CI upload alone does not establish Apple processing, installed-device quality or review approval.

Verified live build page: https://github.com/lukep1100/perkdrop/actions/runs/38172753214

### Website verification and remaining catalogue correction

After the production app-link configuration was deployed, the homepage, privacy page, app-support page and Adelaide suburb-search endpoint returned HTTP 200. The homepage also rendered in the browser with its place groups, category links, featured cards and visible licence credits. The deployment-specific error/fatal log count was empty in the inspected recent window. The drain-list API returned 404, so no claim is made that external log drains or continuous monitoring are configured.

The live Botanic Garden card still shows an expired September availability label. The record's broader timing text already contains both seasons, but its structured availability windows close at 5:30pm and expired on 30 September. The official visit page, checked on 11 October, lists October–March closing at 6:30pm; weekday opening is 7:15am and weekend/public-holiday opening is 9am. A narrowly guarded correction was attempted but the database tool was aborted by the user. Read-back confirmed the old label and validity date remain. No alternative write or retry was attempted. This remains an unresolved accuracy issue, not a completed repair.

Official source: https://www.botanicgardens.sa.gov.au/visit/adelaide-botanic-garden/plan-your-visit

Pending correction for record `PD-2026-0005`:

| Field | Current value | Prepared correction |
| --- | --- | --- |
| Availability label | September hours ending 5:30pm | October–March hours ending 6:30pm; weekday opening 7:15am, weekend/public-holiday opening 9am |
| Recurring window close | 17:30 | 18:30 |
| Validity | Expired 30 September 2026 | 11–31 October 2026, then recheck the official source |
| Price / images / permissions | Existing values | Preserve; no new price, media or permission claim |

The proposed write checks both the record ID and the exact old September label/validity date, so a concurrently corrected record is not overwritten. Its public-holiday note remains explicit; the bounded October validity avoids implying an unverified long-term holiday calendar. The owner's aborted database update is respected. No other method will be used to apply it without renewed authorization.

The App Store Connect browser session expired before the second build's processing verification. The owner completed Apple's secure sign-in flow, and the account now visibly shows Luke Pranter on the PerkDrop TestFlight page. No browser authentication state or credential value was extracted into CI or local commands.

### Live catalogue and image check

A read-only call to the same public catalogue endpoint used by the native app returned HTTP 200 and 216 offers. Of those, 32 had no image URL and 149 referenced `venue-unavailable.svg`; an image URL alone is not a genuine, decoded or permission-cleared photo. Within 50 km straight-line distance of the native Adelaide default, 32 offers were returned across 21 merchant identities; 20 offers had no non-placeholder image. These are metadata counts at inspection time, not an availability, rights or complete image-download certification.

Harry's Bar on Grenfell and The Reserve Social, shown in the owner's screenshots, still have no image in this API response. A frontend repair cannot supply rights to photos that are missing. Do not use random stock/AI images as though they depict these actual venues or advertise that every listing now has a cleared photo.

The native repair selects an existing usable image from the same venue/branch within the displayed card group, rather than allowing its first placeholder to hide a later real photo. It does not borrow from other branches or fabricate missing media. Image attribution is coupled to the displayed photo, SVG placeholders are not represented as venue photographs, and visible Photo source/Licence controls link to safe public URLs. The Union exterior is labelled as the supplied venue photograph, not an uncropped meal poster. The original `public/images/pilot/CREDITS.md` records permission for that exact exterior. Actual source/licence and underlying permission evidence still need to be matched to final demonstration assets.

### Read-only backend/security check

Supabase lists PerkDrop as `ACTIVE_HEALTHY`. Its security advisor returned 78 informational RLS-without-policy findings and one warning: leaked-password protection is disabled. For the six inspected private tables (consumer/device/save/plan/API-credential/media ledger), RLS is enabled and both `anon` and `authenticated` lack direct SELECT privileges; no permissive policies were added merely to silence the advisor. This narrow check is not a complete security certification and does not prove every privileged API or database object is safe.

The native guest identity uses SecureStore and backend-authorized operations. Existing private-access tests cover late responses across pairing/deletion, and deletion only clears access after server-confirmed success. No production guest/account deletion, database/schema mutation, authentication-setting change or customer-data modification was performed during these checks.

Advisor references: [RLS without policies](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) and [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Record the warning for a separately verified authentication hardening pass; do not claim it has been fixed.

## Confirmed rejection

- App: PerkDrop, Apple app ID `6820120968`.
- Submission: `db9b9b8d-ca2e-48d6-8188-8bc843b04897`.
- App Store version: `1.0`; selected binary: `1.0.0 (4)`.
- Status: Rejected / Unresolved Issues.
- Message: **Guideline 2.1 — Information Needed — New App Submission**.
- Apple says the developer account has limited review history and requests more information to complete review. The message does not identify a specific crash, layout defect or minimum-functionality violation. This does not guarantee the absence of other issues or approval after the response.
- The submission contains one Apple message. The resubmit button was disabled during inspection.
- The current App Review Notes contain only 327 characters describing account-free browsing, optional location and external booking links. Sign-in required is unchecked.
- Build Metadata identifies an iPhone-only binary, bundle ID `au.perkdrop.app`, build 4, minimum iOS 15.0, uploaded 10 October 2026 at 12:52 PM in the displayed account timezone. The binary is marked Validated; this is not App Review approval.

## What Apple requires

| Request | Evidence needed |
| --- | --- |
| Physical-device video | Screen recording on an actual supported device running the latest operating system; begin with launching the app, then show typical use and all applicable account/deletion, user-content/reporting/blocking and paid flows. |
| Purpose and audience | What PerkDrop does, who uses it, the problem it solves and its value. |
| Setup and access | Main-feature instructions, working credentials for any account-based access, and sample files if required. |
| External services | The services, tools and platforms used for core functionality. |
| Regional differences | Actual regional functionality and content differences. |
| Regulated/protected material | Applicable authorisation or licence documentation; do not invent permissions. |

Apple asks for the information in **both** the App Review reply and App Review Information Notes.

## Build verification before sending

The repository contains two iPhone approaches: the Capacitor target on `main` and the Expo/React Native app on `feature/native-app`. The branch inspected locally is `846092d2bb029145eca2dae49da2a0d9b7411a71`. Apple build metadata alone does not establish the source commit or runtime of the uploaded binary. Do not assume website changes updated the native Explore screen.

Expo's signed-in project has one successful native iOS build: `6121222c-b018-42f5-b657-034158603bdb`, version `1.0.0 (8)`, testflight profile, SDK 57, source labelled `38d9312` / `fix(ios): remove disabled push entitlement`, created 8 October 2026. App Store Connect separately confirms build 8 is available to the existing PerkDrop Internal Test group, with minimum iOS 16.4 and the PerkDrop associated-domain entitlement. Build 4 is a different upload, with minimum iOS 15.0, and remains selected in the rejected submission. Before final review, select the repaired native candidate actually demonstrated in the new device recording. Do not send a native-build demonstration as proof of a different selected binary. The exact native build-8 source commit could not be resolved through GitHub; no claim is made that it is identical to the retained branch.

The native source has Explore, Map, Saved, My perks, Updates, optional area/location selection, guest device access, source/directions links, and Settings > Delete PerkDrop data. It does not have a conventional consumer email/password registration flow. An automatically created guest identity is still relevant to deletion: show actual deletion, rather than saying the app has no accounts.

The native release configuration disables remote push and contains no in-app payment/subscription integration. Confirm the actual submitted binary before putting these statements into a final response. Do not claim physical-device QA passed based on source checks or web tests.

## Recording guide

Use the installed TestFlight app, not Safari, a simulator, Expo Go, or a mock-up. Confirm the TestFlight build is the one under review. Check Settings > General > Software Update and record the actual iPhone model and iOS version separately for the submission note. Enable Focus so private notifications do not appear.

1. Start screen recording on the Home Screen; tap the PerkDrop icon and let it load.
2. Select Adelaide or a manual suburb/postcode. Show normal browsing without requiring location permission.
3. Browse the category/date controls and search for a real current listing. Clear the search when done.
4. Open a listing, scroll through its price, timing and conditions, and open its current details/official source.
5. Save an offer and open Saved to demonstrate it is there.
6. Open Map, select a place, and show directions. A real venue booking or claim is not necessary merely to prove discovery.
7. If the native Settings flow is present, use a disposable, unlinked guest identity to show Settings > Delete PerkDrop data, type DELETE, and complete deletion. Reopen Saved to show the result. **Do not delete the owner's real saves/plans/passes or any identity connected to another device.** If only the web account flow is present, record the actual account/deletion journey instead and revise the draft accordingly.
8. Show any account registration/login, public user-content/reporting/blocking, or paid access flow that is actually present. Do not omit it because another branch lacks it. Consumer corrections sent privately to staff are different from a public user-content feed; explain the actual behaviour.

A clear 2–4 minute recording is a practical target, not an Apple-stated duration requirement. No editing or synthetic footage is needed. If any step fails, keep the evidence and fix that defect before responding; do not conceal it.

## Notes/reply draft — resolve brackets and verification sentences first

The text below is under App Store Connect's displayed 4,000-character Notes limit. It deliberately preserves unresolved facts rather than claiming a recording, QA, build provenance or rights evidence already exists. Replace the verification sentences with confirmed facts after checking the installed binary and recording. The final reply must include the video and any applicable permission evidence.

```text
PerkDrop — App Review information for iOS 1.0, build [confirmed candidate]

1. Physical-device demonstration
[Attach the recording and add the iPhone model, iOS version, app build and observed results before submitting this response.] The recording must start with launching the installed app and show browsing, area selection/search, listing details, saving, map/directions, and guest-data deletion. Show any other registration, login, user-content or paid flow actually present in this build.

2. Purpose and audience
PerkDrop helps people in Australia find local food offers, events, free activities and other experiences before making plans. It brings places and offers together with prices, dates, conditions and official sources, helping users compare options and decide where to go. It is a public consumer discovery service.

3. Setup and access
Internet access is required for live listings. Browsing does not require an email/password login or a supplied sample file. Location permission is optional; choose Adelaide or use manual suburb/postcode search if permission is denied. Use Explore to browse, select a category or search, then open an offer to view its conditions and source. Use Saved for saved listings and Map for nearby places. Directions and official booking links may open third-party services. Listings are not booking confirmations.
The native-app source uses an automatic guest device identity for saves, private plans and eligible passes. Its deletion route is Settings > Delete PerkDrop data > type DELETE > Delete my PerkDrop data. Confirm this path against the installed build in the recording. Deletion does not cancel bookings made with an external venue.

4. External services and tools
Supabase provides catalogue data, APIs, private guest access and saved-item/pass services. Vercel hosts perkdrop.au and its web pages/APIs. The map uses Leaflet and OpenStreetMap tiles; directions may open Google Maps. Venue and organiser websites provide official information and external booking services. Web fonts/assets use Google Fonts and jsDelivr. The project has a native Expo/React Native branch and a Capacitor web-shell target; confirm which produced the submitted binary before describing its runtime. The inspected native release configuration has remote push disabled and no in-app payment/subscription integration. Confirm these settings against the submitted build.

5. Regional operation
The service is intended for Australia. The browsing model is consistent, but listings, business coverage and available offers vary by area. Adelaide is a starting area; manual area selection and Australia-wide browsing are available in the native source. Outside Australia, users can select an Australian area. Dates and service windows use the venue's local time; availability is subject to each listing's conditions.

6. Regulated services and third-party material
PerkDrop is a local discovery service rather than a regulated medical, financial or gambling service. Public-source listings do not imply endorsement or a business partnership. Source attribution and permission to reuse imagery are separate checks. For protected material visible in the demonstrated build, supply the applicable licence or permission evidence and required attribution. Existing project records document venue-supplied Union Hotel imagery and Creative Commons imagery for AGSA, South Australian Museum and Adelaide Botanic Garden; these records must be matched to the actual assets shown. Do not claim that a website URL or a source listing grants image-reuse permission.
```

## Existing rights records

Project records, rather than a fresh certification of all catalogue imagery:

- `docs/data/local-pilot-priority-offers-2026-09-14.csv`: venue-supplied Union Hotel artwork; AGSA CC BY-SA 4.0 exterior; South Australian Museum CC BY 2.0 entrance; Adelaide Botanic Garden CC0 entrance.
- `docs/local-pilot-operations-2026-09-14.md`: distinguishes factual/source verification, image reuse permission and commercial partnership. It explicitly leaves other permissions unresolved.
- `docs/production-onboarding-2026-09-14.md`: documents the four approved hero assets at that time. It does not authorise every current national image.

Match the asset author/source/licence/scope to every protected image shown in the demonstration, preserve required credits, and supply the original permission/licence evidence where applicable. A prior internal status summary is not a substitute for the underlying licence or business permission.

## Completion path

### First physical-device recording received

Inspected `ScreenRecording_10-11-2026 16-22-32_1.mp4`: 56.74 seconds, 512 × 1112, 30 fps. The original uploaded file was preserved. An overview at four-second intervals and a second-by-second visual overview were inspected locally; generated review images are temporary internal working files.

| Flow | Observed in this recording |
| --- | --- |
| Launch from the Home Screen | Missing: recording begins inside PerkDrop while listings load. |
| Native Explore / listing details | Present: Union Hotel and its conditions are shown. |
| Search / manual area selection | Not demonstrated. |
| Save an item, then Saved tab | Not demonstrated. |
| Native Map tab | Not demonstrated. |
| Official booking handoff | Present: external Now Book It pages appear. No successful venue booking is demonstrated. |
| Directions | Present: Google Maps route appears. The route also exposes a current starting location; use a manual area/test start point for final review footage. |
| Settings / guest-data deletion | Not demonstrated. Do not delete the owner's real identity to create evidence. |
| Latest iOS / precise app-build confirmation | Not visible; confirm separately before submission. |

This is a useful genuine-device demonstration, but it does not complete Apple's requested evidence. Do not upload it as though launch, saves, account/deletion and all main features have been covered.

The native date/category rows are readable during initial loading, then collapse and clip their labels once listings render. The horizontal ScrollViews specify `flexGrow: 0` but leave the default shrinking behaviour in place. A repair has been prepared in the isolated `fix/ios-filter-sizing-20261011` worktree: disable row shrinking, reserve a height based on iOS font scale, centre the chip contents, and retain at least 44-point controls. The fix has not been verified on a physical iPhone or installed in the user's TestFlight app.

Verification: all 58 existing mobile tests passed; the patched iOS JavaScript/Hermes bundle exported successfully with Metro (680 modules). These checks establish source/bundle readiness, not physical-device layout or Apple approval. A new signed build is required to deliver this native source repair.

The source repair is now saved to GitHub branch `fix/ios-filter-sizing-20261011`, commit `9599298c216abce876e217714daf00c56ad28665`. It changes only `mobile/App.js`; production `main` and the website deployment were not changed by this repair. Normal `eas whoami` returned **Not logged in**. No EAS build was started, no signing credentials were extracted, and no new TestFlight binary was uploaded. Connect the intended Expo build account before creating the repaired signed candidate.

### Build delivery preparation

The Expo browser is already signed in as `luke1100`, under `luke1100s-team`; CLI authentication remains unavailable. The project has no GitHub connection, so the browser's Build from GitHub action is disabled. The official Expo GitHub authorization screen is open and requires permission to verify GitHub identity `lukep1100` and read its email addresses. Authorization has not been accepted. New account/repository access needs the owner's confirmation before proceeding; any repository installation should be limited to PerkDrop. If the organization cannot link this personal GitHub repository, use a supported normal CLI sign-in flow rather than transferring ownership or broadening access without approval.

Update after owner approval: the GitHub identity/email authorization was accepted. GitHub then presented a separate Expo app installation requesting read/write access to actions, administration, checks, code, commit statuses, deployments, issues, pull requests, repository hooks and workflows. The installation form is staged with **Only select repositories**, exactly one selected repository: `lukep1100/perkdrop`. The final Install & Authorize action has **not** been clicked because this materially broader repository access requires separate confirmation. No build or TestFlight upload has started.

Latest update: the owner explicitly approved Install & Authorize, and completed GitHub Mobile verification. Expo visibly confirms `lukep1100/perkdrop` is connected; its base directory is saved as `/mobile`. The free plan displays 15 iOS builds per period and one iOS build used. No paid plan or upgrade was selected. The build form is prepared for iOS, production build/submit profiles, commit `ab2199ad1c52449cd800f4eb7979e88d826d4e21`, and automatic store upload, but **Confirm was not pressed**.

Expo warns that no iOS build credentials are stored for this app. The iOS credential setup was inspected for `au.perkdrop.app`, App Store distribution; Choose saved certificate explicitly reports **There are no saved distribution certificates**. No certificate, private key, profile or new signing credential was uploaded or created. Building is paused pending permission to configure Apple signing and store the distribution certificate/private key and PerkDrop provisioning profile in Expo. Do not expose signing material in logs, repository commits, screenshots, reports or downloadable artifacts. No repaired binary has been built or uploaded yet.

The build-8 log confirms disabled push signing was repaired after the branch's retained base. The repair branch now also includes a capability guard: when `EXPO_PUBLIC_PUSH_ENABLED` is not `true`, the generated native iOS entitlements omit APNs push capability. Expo's generated configuration was checked with push both disabled and enabled; associated domains remain intact in both cases. The disabled configuration initially exposed a reverse-mod-order issue, which was corrected before saving. EAS profiles now specify an iOS image for GitHub builds and the submit profile targets Apple app `6820120968`.

All final source/configuration changes are saved on the repair branch at `694b2797425dc77d38f181ef7ec3079ad5ac90b5`. No new signed build or upload has started. Generated-configuration checks are not a substitute for a successful signed build, TestFlight installation or the final physical-device recording.

1. Obtain the genuine physical-device recording and confirm the demonstrated binary and QA results.
2. Resolve runtime, exact account/deletion steps, paid/UGC applicability and protected-material evidence in the draft.
3. Place the complete factual information in Notes and prepare the same response with the video for App Review.
4. Only then submit the review response/resubmission through the applicable App Store Connect flow. Do not claim a new binary is required solely because of this information request; a new build is needed if the demonstration reveals a defect requiring code changes.

Review page observed: https://appstoreconnect.apple.com/apps/6820120968/distribution/reviewsubmissions/details/db9b9b8d-ca2e-48d6-8188-8bc843b04897
