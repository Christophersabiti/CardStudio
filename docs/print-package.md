# Print package

The single-card editor offers **Download print package** for Basic and Premium (including an active trial of either plan). Free cannot use the protected export endpoint. Active super admins, verified from the internal account by the server, also receive access regardless of billing plan. Ordinary admins still require Basic/Premium. Ownership, session, revision, and publication checks apply to everyone. Existing QR, vCard, and digital-card exports are unchanged.

The download is one ZIP with exactly `front.pdf`, `back.pdf`, and `mockup.png`. Front is the name/QR face; back is the profile/contact face, following the reference's labels. The back's scan-mode label and mockup footer follow the selected QR type. Each download regenerates every face from one saved revision. The reusable scene and fonts are bundled in `assets/print-package`; personal card contents are never baked into that template.

## Saving and QR modes

`CardData.qrMode` persists `dynamic` (Online) or `offline`. Missing legacy preferences default to Online on read; there is no bulk data migration. Validation adds the default on the next save. Draft recovery and duplication carry explicit preferences. Publishing does not replace Offline with Online.

Online exports require a live published card whose contact data matches the saved draft. Export preferences are excluded from publication-content equality. Private save does not publish automatically. A canonical HTTPS `NEXT_PUBLIC_SITE_URL` must be configured; local, numeric IP, preview Vercel, credential-bearing, and path-containing URLs are rejected for print. Offline exports embed the saved vCard without requiring publication. Saved PDFs/PNGs and printed contact text are snapshots, even when their Online QR follows future published updates.

## Print contract

- Landscape trim: 85.6 × 54 mm. The physical layout is independent of the digital-card orientation.
- Presets: exact size, or 3 mm bleed on all sides (91.6 × 60 mm outer page).
- PDFs: separate single-page files, explicit TrimBox/BleedBox, vector QR and outlined Noto Sans text. Outlines avoid font substitution and retain supported accented names and credentials.
- Images: server-owned photo/logo only; reject effective image resolution below 150 PPI. The mockup is 3072 × 2048 RGB PNG with 300 DPI metadata.
- QR: black modules, four-module white quiet zone, correction M; reject density below 0.25 mm/module. Decode the entire rendered front at approximately 300 DPI before delivery.
- Back layout: at most four phone/email rows and four websites. Overflow, unsupported glyphs, and overly dense QR payloads return a specific error; values are never silently omitted or shortened.
- Small text can be approximately 5–6 points in this dense reference layout. A physical proof remains necessary, especially for dense contact details and offline QRs.
- RGB output, not certified PDF/X or CMYK. Confirm the preset and colour requirements with the printer. The mockup is a visual proof and does not certify material, finish, or manufacturing quality.

## Server flow

`POST /api/cards/[slug]/print-package` accepts only `{revision, preset}`. It checks origin, verified application identity, a six-per-minute export limit, owned record, effective plan, saved revision, publication, and bounded schema. The server resolves images via owner-filtered internal media IDs and reads the private bucket directly. No public export bucket, signed URLs, or client-provided card/QR image is used.

After rendering, the service rechecks record revision/publication and effective plan. A failed render returns no ZIP. Responses use `private, no-store`; the ZIP is generated on demand and is not retained server-side. `GET /api/print-package/access` provides the matching UI capability and fails closed when plan verification is unavailable.

The orientation controls include a shortcut to the print-package panel below the preview. Unsaved edits must still be saved, and Online details must be published before download.

No schema migration is required. `effective_plan` remains the source of subscription/trial expiry behavior. Basic/Premium capability is centralized in `hasPrintPackage`. Adding a new eligible plan requires explicitly updating that capability.

## Verification

`tests/print-package.test.ts` covers default/persisted modes, publication matching, canonical origins, entitlement denial, ownership, revision races, expiry during rendering, archive contents, physical PDF boxes, mockup dimensions, QR decoding from the flat face and finished mockup, Unicode credentials, content changes, overflow, and inadequate images. Existing subscription/trial tests cover the effective-plan database behavior.

Required release checks: `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`. Next output tracing explicitly includes the scene, fonts, brand images, and social icons. For a printer proof, rasterize the final PDFs at 300 DPI, decode the QR, print at actual size, and test on multiple phones. The local automated and raster checks do not substitute for a physical proof or a live paid-account acceptance check.
