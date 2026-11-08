# PerkDrop discovery upgrade — 8 November 2026

The released iOS 1.0/build 11 is available in Australia. This update prepares native version 1.1.0 and upgrades the shared live map, catalogue and web guide. Native UI changes require a new signed build, device acceptance and Apple review; a Vercel deployment alone does not change the native Home screen.

## User experience

- A visible 1–200 km slider and 10/25/50/100 km shortcuts retain the selected radius when choosing a suburb or requesting foreground location.
- The map draws the actual distance circle and search centre. Dragging the map and selecting “Search this map area” changes the search centre; native messages accept only bounded Australian coordinates from the trusted map document.
- Empty areas offer an explicit, evidence-based wider radius and show real suggestions outside the selected area with distance labels. Nationwide alternatives are labelled as farther afield. Query, category and reviewed date filters remain applied; distance never silently expands.
- The native guide has a new visual hierarchy, free-plan collections, suggestions informed by saved categories, illustrated listing cards when photography is unavailable, and current local listings. Empty and loading states are separate.
- The web guide uses cleared imagery with its attribution, original illustrated graphics, free-plan collections and the same distance/empty-area rules. Photo availability no longer removes valid free events from home discovery.

## Catalogue and automation

The existing five-minute source watcher and nationwide discovery continue. Current candidates still pass source verification, expiry, commercial-approval and imagery-rights rules; this update does not bypass those gates or invent free admission from a conditional free option. Recommendations use checked dates and recorded preferences, not generated event facts.

Nearby enrichment now scopes public catalogue candidates by the existing spatial RPC before the 500-row browse limit. A busy national feed can no longer crowd out an eligible local ID. Clients fetch a bounded 200 km local feed when the search centre changes and prioritise those results within a 500-item cache. Radius dragging uses that same local feed rather than creating a request for every slider movement.

## Source and release

The actual shipped native source from `fix/ios-push-readiness-20261012` (`7231345`, with build-11 release evidence) is integrated into the canonical project under `mobile/`. The older Capacitor scaffold is retained as historical source but is not used to produce this candidate. Existing private-identity, saved-item, pass, pairing, notification consent and deletion guards are retained.

Native candidate: **1.1.0**, initial build **12**. Store metadata is a draft for that candidate. The currently live 1.0 listing is not replaced until the new binary has been checked and accepted by Apple. No new marketing notifications, email sends or social posts are enabled by this change.

Validation covers radius bounds, unknown coordinates, deduplication, explicit widening, filter preservation, expired/conditional-free rejection, local rows beyond the national cutoff, native map message boundaries, existing mobile privacy/notification contracts, and iOS/Android/web bundle export. CI additionally builds an unsigned iPhone archive. Physical-device visual and interaction acceptance remains distinct from browser preview or bundle compilation.

Native toolchain patches are aligned to Expo SDK 57.0.32, with SDK-recommended crypto/location/notification modules and slider 5.2.0. Compatible audit fixes remove the high-severity toolchain findings. Four moderate advisories remain in Expo's fingerprint/glob/minimatch build tooling; npm proposes an incompatible SDK downgrade, which is not applied. These are distinct from the root website dependency audit and from device-runtime verification.
