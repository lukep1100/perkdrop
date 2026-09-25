# PerkDrop store listing draft (en-AU)

App name: PerkDrop
Subtitle / short description: Local deals worth knowing
Category: Lifestyle (review final category selection in each store)
Support: https://perkdrop.au/contact
Privacy policy: https://perkdrop.au/privacy
Contact: perkdropofficial@gmail.com

## Short description (Google Play)
Find local offers, events and things to do across Australia.

## Full description
Know what's worth doing before you make plans.

PerkDrop brings local offers, events, food, drinks, experiences and family activities into one place. Choose a suburb or postcode, use Near me for a 25 km area, or explicitly browse across Australia. Filter verified dates and check evidenced age and group-cost information.

Browse places with their offers together, check dates and conditions, and open the official source before you go. Save offers, connect your devices with a private single-use link and create an outing in the website planner. Where a venue supports an in-app Drop, you can claim available places and keep the pass in My perks.

Listings and availability can change. Always check the current conditions and confirmation shown for each offer.

## Apple promotional text
Food, events, experiences and genuine local perks — before you make plans.

## Apple keywords
deals,events,food,activities,experiences,local,family,offers

## Review notes
The app opens directly to a public catalogue; no login is required to browse. Saved items and in-app claims use a device-held anonymous credential. Location permission is requested only when Near me is tapped. The Map tab presents PerkDrop's live website map inside the app. Claims are shown only for eligible offers with available capacity; the reviewer may not see a claimable offer at all times. Privacy: https://perkdrop.au/privacy. Support: perkdropofficial@gmail.com.

## Store data disclosure draft — verify against the final binary
- Device-held anonymous credential: used for saved offers, pass history and updates; stored with Expo SecureStore and represented server-side by a hash.
- Purchases/claims: offer, party size, pass status and codes stored by Supabase where an in-app claim is made; no payment in the app.
- Precise location: accessed only after the user selects Near me; used to filter listings within 25 km. The selected point is rounded to three decimals before local SecureStore storage and the website map URL. No background location is requested.
- Analytics: pseudonymous installation ID, 30-minute visits, viewed listings, searches, saves and outbound actions. Preview traffic is internal.
- Website map and external links: may collect usage, referral, and request information as disclosed at the privacy policy.
- Push notifications: not included in this build. Do not claim push permission or delivery in store disclosures.
- No ads or in-app purchases are configured in the native app. Some catalogue destinations may be affiliate or sponsored as disclosed with the listing and site policy.

## Remaining account and asset work
1. The existing EAS project is linked. Confirm signing access and ownership of bundle ID `au.perkdrop.app` in Apple Developer and Play Console.
2. Create signed iOS and Android test builds and test discovery, search, map, saves, claims, passes, permissions, external links and errors on real devices.
3. Capture required screenshots from those tested builds at the device sizes requested in App Store Connect and Play Console.
4. Complete each store's privacy/data-safety and content-rating questionnaires from the final binary and actual data practices.
5. Supply Apple signing access and Google Play developer access; use EAS to submit review builds. A new personal Google Play developer account may need closed testing before production access.
6. Add push notifications only after the delivery service, consent, credentials and physical-device test are complete.
