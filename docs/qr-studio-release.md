# QR Studio release notes and setup

Implemented locally on 7 September 2026. This change does not deploy the app or apply the new migration to the hosted database.

## What is included

- `/qr-studio`: event, location, links, image, video and website builders; mobile visitor preview; private drafts and explicit publication.
- Event start/end times with IANA timezone conversion, cancelled/ended states, address/directions, contact details, external RSVP/tickets and calendar download.
- Ordered link buttons and optional media blocks on event/place/link pages.
- Center logo/image, fit-or-square-crop choice, dark QR colors and captions; live draft design preview; scan-validated plain PNG, titled/captioned PNG and SVG exports.
- `/dashboard/qr`: owner collection, pagination, edit, duplicate, unpublish, archive/unarchive and recoverable Trash. Draft changes do not overwrite published content.
- `/q/[slug]`: stable, non-cached scan entry point. Website codes redirect; other types open `/view/[slug]`. Direct image/video experiences open a focused viewer. Visitor accounts are unnecessary.
- Private raster uploads and direct-to-storage video uploads with progress, cancellation, byte validation, owner checks and quota reservations. Image metadata is stripped by WebP re-encoding; image dimensions are retained rather than reduced to contact-photo size.
- YouTube/Vimeo embeds, direct MP4 playback and explicit external-video fallback. Uploaded MP4 support is deliberately limited to conventional H.264/AAC containers, five minutes and 50 MB. The container inspector validates structure, declared duration and codec entries; it does not transcode or fully decode the video stream. Browser playback remains a release check.
- Aggregate QR opens/link clicks when effective plan analytics is enabled. Opens are requests, not a count of unique humans or provable physical scans. Owner preview links use `/view` and avoid the scan counter. Known crawler/prefetch requests are excluded; this is not complete bot detection.

## Activate in the hosted environment

1. Verify the current remote migration history against the local files; preserve the existing baseline reconciliation rules in README. Apply only missing migrations in order, including `supabase/migrations/20260907070327_event_media_qr_studio.sql`. The new migration is additive except for extending the allowed QR content types.
2. Deploy the application with the existing server-only Supabase credentials and correct canonical `NEXT_PUBLIC_SITE_URL`. Print exports always encode this canonical origin, not an arbitrary request host.
3. Use Clerk development keys for localhost, or test on the configured production domain. The current local browser reports that production Clerk keys are restricted to `cardstudio.sabtechonline.com`; authenticated local testing is therefore blocked until the environment matches. Do not disable authentication to work around this.
4. Schedule `npm run cleanup:qr` at least hourly in a trusted server environment. It removes expired staging objects, releases reservations, deletes expired unused assets after a one-day grace period and applies 90-day aggregate metric retention. The command requires the server environment; it must never be run with a browser/public key. It was not run against hosted user assets during development.
5. Review effective plan storage limits and feature flags. Existing logo/color/SVG/analytics flags are enforced, with the existing superadmin/disabled-quota override. No plan prices or allowances were changed. A Free account with 5 MB cannot upload a 50 MB video; smaller media or an appropriate plan is required.

## Upload reservation and revocation behavior

Incoming upload buckets have 1, 5, 10 and 50 MB caps; the server chooses the smallest fitting bucket and reserves its entire cap. This bounds storage even if a client lies about file size. An additional reservation covers the validated ready object before storing it. Published files have a separate immutable path from signed upload targets.

Signed upload links can remain usable for two hours, so the incoming reservation is held for three hours and until cleanup succeeds, including after cancellation or successful completion. The stored file and temporary reservation both count during that interval. Larger uploads therefore need temporary storage headroom. Reservations remain if storage cleanup fails, allowing a safe retry. A deployment interruption during an object write can leave an unreferenced object; periodic storage reconciliation should compare object keys with database paths before deleting any such objects.

Images recheck publication or ownership on every request. Video delivery uses 60-second signed URLs so storage can serve byte-range requests. Unpublishing prevents new delivery URLs; already issued URLs can remain usable until expiry. Downloaded files and screenshots cannot be recalled. Long-paused video sessions may need a page refresh to get a fresh delivery URL.

## Verification and release acceptance

Verification result: 68 tests passed; typecheck, lint and production build passed. Desktop and mobile layout checks passed. Hosted authenticated integration and physical-device acceptance remain pending as described below.

Automated checks cover strict publication versus incomplete drafts, unsafe URLs, contrast, timezone/DST edge cases, calendar escaping/folding, exact embed hostnames, QR decoding after compositing/resizing, actual H.264/AAC container inspection, database asset ownership, quotas, public revocation, cleanup reference retention, analytics increments and browser-role denial.

Desktop and 390-pixel mobile browser checks used temporary synthetic event content and verified layout, venue/directions updates, editor tabs and live QR rendering. The temporary preview route was removed. No real event was published during those checks.

Before public release, run an authenticated test on a migrated test environment: create an event, upload cover/logo, publish, download, scan, change venue, republish and scan the original print. Check image and MP4 upload/playback/seek, interrupted uploads, insufficient quota, two-tab revision conflicts, cross-owner access, unpublish/republication, archive/Trash/restore and contact/group regressions. Verify physical iPhone and Android camera scans on paper and screens. Local automated decoding is not a substitute for those device checks.

Deferred refinements: adaptive streaming/transcoding, native ticketing/RSVP/check-in, advanced analytics, password-protected events, and specialized print/PDF layouts. Current service is a public sharing destination, not an admission credential.
