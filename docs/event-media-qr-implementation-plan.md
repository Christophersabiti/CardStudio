# Event, location and media QR implementation plan

Status: approved and implemented locally. See [release setup and verification](qr-studio-release.md) for hosted activation and acceptance checks.
Prepared: 7 September 2026.

## Product direction

Extend Card Studio with a QR Studio for events, places, collections of links, images and videos. Each published item receives a permanent Card Studio URL. Scanning opens the latest published experience without requiring the visitor to sign in. Owners can update content without reprinting the QR.

The QR contains the URL, not the uploaded video or all the event details. These experiences require internet access. Existing offline contact QR codes remain a separate capability.

Treat the supplied screenshot as a visual reference for the current QR sharing page, not as additional instructions. Retain its warm white background, dark typography, generous spacing and simple primary action; expand its contact-only message when the service is ready.

## Linktree benchmark

Source reviewed: [Linktree QR code generator](https://linktr.ee/features/qr-code-generator), 7 September 2026. This is a review of the public feature page, not an authenticated product test.

| Area | What the source establishes | Card Studio proposal |
| --- | --- | --- |
| Scan destination | Opens a Linktree containing links/content | Choose an event page, place page, link collection, image or video |
| Branding | Custom colors and designs | Brand color, uploaded center logo/image and caption outside the QR |
| Sharing | Codes can be printed across physical materials | Download a plain QR or a composed QR card for posters/table displays |
| Updates | Content can change without regenerating the QR | Permanent URL with explicit publication snapshots |
| Measurement | Promotes scan analytics | Begin with aggregate QR opens and action clicks |

The page does not establish custom center-logo upload, caption controls, native event fields, uploaded-video behavior, file limits or exact export formats. Those are our proposed capabilities, not verified Linktree parity. Do not infer current paid-tier entitlements from the marketing page.

## Experiences to build

| Type | Owner supplies | Visitor sees after scanning |
| --- | --- | --- |
| Event | Title, cover, description, start/end, timezone, venue, address, directions and ordered links | Event details plus Get directions, Add to calendar, RSVP/tickets and other configured actions |
| Location | Hotel/restaurant/place name, image, address, optional coordinates, hours, contact and links | Place page with directions, menu, booking, website or call actions |
| Links | Title, description, optional cover and ordered labeled URLs | A focused mobile page of tappable links |
| Image | Uploaded image or external image URL, title and alternative text | Image-first viewer with zoom/open-original affordance where available |
| Video | Uploaded video or supported video URL, title, optional poster | Video-first viewer with playback controls; no required intermediate link page |

An event may also contain image/video blocks. A single external website can use the existing URL type and redirect immediately. For media, default to the viewer; optionally opening an external original is an explicit owner choice. Unsupported video platforms get an honest Open video action rather than a broken embed. Playback may require a tap: do not promise automatic playback with sound.

RSVP, bookings, ticket purchases and menus initially link to existing destinations. Native ticketing, attendance/check-in, payments and lead capture are separate projects. A publicly shared event QR is not an admission credential.

## Creator flow and design

1. Choose Event, Location, Links, Image or Video.
2. Add content in a type-specific form with a live mobile preview.
3. Customize the QR: title, center logo/image, accessible dark color and caption such as “Scan for event details”, “Scan to view the menu” or “Scan to watch”. Keep caption text outside the quiet zone. Offer a logo crop preview and reset.
4. Preview the visitor experience, save a private draft, then publish.
5. Download PNG; offer SVG according to the agreed plan rules. Export either the QR alone or a layout with title and caption. Copy the permanent link.
6. Manage from the dashboard: edit, publish updates, duplicate as draft, unpublish, archive and Trash/restore.

Desktop: form and preview side by side. Mobile: Content / QR design / Preview steps with clear save state and upload progress. Include validation, retry/cancel, empty states and publication status. Changing the published content preserves the encoded URL. Changing the printed caption or logo requires downloading/reprinting the design.

## Existing foundation and required changes

Repository inspection found Next.js/React, Clerk authentication, Supabase persistence/storage, ownership checks, private drafts, publication snapshots, revision conflict checks and quota infrastructure.

- `lib/qr.ts` currently produces plain PNG QR codes with medium error correction and a four-module quiet zone.
- `lib/downloadQrCard.ts` already composes contact QR exports; generalize the layout inputs for arbitrary title/caption without breaking contact exports.
- `lib/saas/types.ts` and the SaaS foundation migration already define `qr_codes`; extend their allowed types with `event`, `links`, `image` and `video`, retaining `location` and existing types.
- Existing QR records have title/caption/description, data, publication, revision and archive/delete fields. Store the entire public presentation in the publication snapshot so draft titles, logos and media cannot leak through top-level fields.
- Existing quotas include active/monthly QR counts and storage bytes. Plan feature flags include logo, colors, SVG and analytics. Check the effective entitlement implementation before wiring controls; seeded flags alone do not establish live availability.
- `lib/media.ts` is a contact-image path: 420 KB input limit and resize to 640 × 640. Preserve that behavior for contacts and introduce a dedicated asset pipeline for this service.
- `lib/marketing.ts` provides the screenshot’s current QR copy. Update it and the navigation only once the corresponding experience is available.

## Architecture and data contracts

Use the existing `qr_codes` resource, with a versioned, validated discriminated payload per content type. Common fields include title, description, design, logo asset reference and caption. Type-specific fields cover event times/timezone/status, venue/address/coordinates, ordered links, and media source/asset ID/alternative text/poster.

Proposed routes: `/qr-studio` for creation, `/qr-studio/[slug]` for owner editing, `/q/[slug]` as the permanent scan entry point, and `/api/qr-codes` plus item endpoints for authenticated mutations. Check for route collisions during implementation. Reuse proven ownership and revision behavior, but avoid forcing QR payloads into card-specific validation.

The public resolver reads only published snapshots of non-deleted, non-archived records. It renders an event/location/link/media page or issues a temporary redirect for a URL destination. Never use a permanent redirect that could pin an old destination. Unpublished items show a neutral unavailable page without draft information. Past events stay available with an “Event ended” label; do not automatically expire their codes. Support a cancelled-event status.

Retain existing Clerk-compatible owner isolation, server-validated mutations, same-origin checks and rate limits. Extend database type constraints, quota integration and media publication checks through an additive migration. Verify current Supabase documentation and actual migration state before implementing or applying changes.

## Media delivery

Use private asset storage with metadata for owner, kind, MIME type, byte size, dimensions/duration, processing state and storage key. Track asset references in both drafts and published snapshots. Authorize public delivery only through current published references, including center logos and covers.

For uploads, issue short-lived authorized upload targets, validate final bytes and ownership before marking assets ready, reserve quota atomically, and release reservations on failure/expiry. Publishing must reject pending/failed uploads. Clean abandoned assets after a grace period; never delete assets still referenced by another draft or publication.

Initial proposed limits: raster PNG/JPEG/WebP images up to 10 MB; uploaded MP4 with H.264/AAC up to 50 MB and five minutes. These are product defaults to validate against hosting and effective storage quotas, not existing capabilities. Provide image variants while retaining a suitable original. Reject unsupported video codecs clearly. Use direct-to-storage uploads and range-capable playback delivery rather than buffering videos through a normal JSON endpoint. General transcoding/adaptive streaming can follow if demand warrants it.

External URLs must use approved schemes. Allowlist supported video embed providers; never accept arbitrary embed HTML. Do not fetch arbitrary external URLs on the server. Clearly explain external hosts may restrict viewing or remove files. If playback uses signed delivery URLs, document that an issued URL can remain valid until its short expiry after unpublishing; downloaded copies cannot be recalled.

## QR reliability and analytics

Use high error correction for logo QR codes, a conservative bounded center image with a white backing, preserved functional patterns and four-module quiet zone, and dark-on-light contrast. Treat logo limits as tested constraints, not a guaranteed error-correction percentage. Decode the final composited export, including the logo, in automated tests. Block unsafe design combinations and provide a plain QR fallback. SVG exports should be self-contained and contain no active uploaded SVG content.

Measure aggregate scan-entry requests and action clicks without making analytics availability a dependency of page loading. Call the metric “QR opens”: HTTP requests cannot establish exact physical scans or unique people. Exclude owner previews and known bots where practical. Avoid precise location collection and persistent visitor identifiers for the initial release. Define retention and feature entitlements before enabling collection.

## Delivery sequence and acceptance gates

1. **Contracts and persistence:** payload schemas, additive migration, owner CRUD, snapshots, stable resolver and quota enforcement. Gate: another owner cannot access/edit a draft; draft edits cannot change public output; concurrent edits return a conflict; unpublished and archived destinations stop serving content.
2. **Event/location/link builder:** responsive forms and public pages, ordered buttons, directions and timezone-correct calendar download. Gate: a published event can change venue without replacing the QR; calendar times match the event timezone; empty/invalid links and invalid dates are handled.
3. **Branded QR exports:** uploaded center image, colors, caption and composed/plain PNG, then SVG. Gate: exported codes decode to the stable URL at representative sizes; long captions fit; physical iPhone/Android scans pass on screen and paper.
4. **Images and external video:** dedicated image uploads, image viewer, provider adapters and event media blocks. Gate: an image scan opens the image-first view; a supported video opens its player; broken/unsupported links have useful fallback behavior; private assets stay private.
5. **Uploaded video:** direct upload, validation, quota reservations, delivery and cleanup. Gate: interrupted upload retries safely, oversized/invalid files fail clearly, playback/seek works on mobile, and unpublish revocation matches documented delivery semantics. This phase is required to fulfill the requested upload-video scope.
6. **Release integration:** dashboard management, effective plan controls, aggregate analytics if enabled, marketing copy and regression coverage. Gate: typecheck, lint, relevant unit/integration tests and production build pass; contact and group publishing/export still work; hosted migration/auth readiness is verified separately from local tests.

First reviewable milestone: publish an event with venue/address and several links, add a center logo and caption, export its QR, scan it, then update the venue and scan the same printed code again. Continue through media phases before calling the full request complete.

## Decisions and defaults

Proceed with dynamic hosted URLs, one account-owned resource per QR, current Card Studio styling, external RSVP/booking links and explicit publication. Do not add a separate billing system. Before release, settle logo/SVG availability by plan and upload/storage allowances: current seeded Free storage is only 5 MB, so the proposed video allowance requires a compatible entitlement. Confirm deployed schema/auth readiness and bandwidth budget during the foundation phase. These do not prevent starting the event workflow.
