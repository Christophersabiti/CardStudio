# Card Studio Print Package

## Recommendation

Add **Download print package** to the authenticated single-card editor and saved-card workflow. One click should download one ZIP containing exactly three deliverables: `front.pdf`, `back.pdf`, and `mockup.png`. Basic and Premium receive the feature; Free receives an upgrade action. Every file must come from one immutable card snapshot and one resolved QR mode.

Use the attached composition as a reusable design reference: the front contains the name and a large QR; the back contains the profile and contact details; the mockup presents both flat faces, angled views, and a hand-held front. Persist the template and its configuration, then regenerate its card faces from current saved details. A downloaded image remains a snapshot; it cannot change after download.

Online should be the default for new cards and existing saved cards without a stored preference. Preserve an explicitly selected Offline preference when saving and reopening. Saving privately must remain separate from publishing: a private saved card may default to Online, but must be published before its online print package is downloadable.

This is an implementation proposal based on the local repository and primary documentation reviewed on September 9, 2026. No application behavior or database configuration has been changed. The reference image is preserved beside this report as `mockup-reference.png`.

## Scope and interpretation

The required outcome is a coordinated three-file download, dynamic mockup content, alignment matching the supplied reference, QR-mode persistence, and availability on non-Free billing packages. PDF for the two print faces and PNG for the mockup is a recommended format choice, not a previously specified requirement. A three-PNG variant is possible if the selected printer requires images.

There is one naming ambiguity: the reference labels the QR face **Front Side**, while the request associates online/offline with the back. Preserve the reference labels and make QR mode a package-wide setting. It determines the actual QR payload on the front and any scan instructions on the back or mockup. Do not introduce a second, independently selected QR mode. If the intended QR face is actually the back, swap the face labels and output mapping together before implementing.

The example's names, contact details, photo, logo, and printed specification claims are reference content, not global template defaults. Future cards must use their own saved data. The reference's “CMYK Colour Mode” and “Ready for Print” labels do not establish that generated files meet those conditions.

Initial scope should cover individual cards. Group cards encode a directory URL and can hold hundreds of people; the compact personal layout does not map to that model. Their existing exports should remain available.

## Existing implementation

The repository already supplies useful primitives, but none is a finished physical-print renderer. The following findings are from the local source files listed in Sources.

| Area | Observed behavior | Required change |
|---|---|---|
| Action buttons | `CardActions.tsx` downloads VCF, named QR PNG, or digital-card PNG | Add a distinct print-package action with entitlement and readiness states |
| Digital capture | `captureCard.ts` uses `html-to-image` at pixel ratio 2 | Do not equate browser screenshot dimensions with physical print dimensions |
| Named QR | `downloadQrCard.ts` builds a 720 × 920 portrait canvas with shadow | Build a separate landscape physical front; preserve the existing export |
| QR generation | `qr.ts` uses correction M, margin 4, and a 512-pixel default | Reuse encoding rules; render a vector QR or correctly sized raster for print |
| QR selection | `Studio.tsx` initializes published cards as dynamic, others as offline | Persist the preference and default missing values to dynamic |
| Publish action | Publishing forcibly sets mode to dynamic | Preserve an explicit offline preference rather than silently replacing it |
| Saved shape | `CardData` has no QR preference; schemas are strict | Add the field to types, validation, recovery, save, and duplicate paths |
| Revision model | Records have `revision`, private `data`, and `published_data` | Export one revision and detect concurrent changes |
| Export authorization | `SessionGuard.tsx` checks an active session | Add server-side owner and billing checks for the new feature |
| Billing | Plans are Free, Basic, Premium; `effective_plan` includes active trials | Define entitlement explicitly, including trial treatment |
| Images | `media.ts` converts uploads to WebP, bounded at 640 × 640 | Evaluate effective resolution at the placed print size |

The current editor deliberately disables dynamic QR output when current details differ from the published snapshot. Preserve this protection. The public card route independently generates a profile URL QR; changing the owner's print preference does not require changing the public page's existing QR behavior.

## Download experience

Place the new action alongside the existing save/download actions. The helper text should read **Front PDF, back PDF, and mockup PNG in one ZIP**. A ready card needs no format dialog on every download; show the selected print preset and QR mode beside the preview.

| State | Suggested UI behavior |
|---|---|
| Guest | Sign in to download a print package |
| Free | Upgrade to download print package |
| Paid, unsaved | Save card to prepare print package |
| Paid, Online, private | Publish card to enable online QR |
| Paid, Online, unpublished edits | Publish updates to match your print package |
| Paid, Offline, saved | Download print package |
| Paid, valid and ready | Download print package |
| Rendering | Preparing 3 files…; prevent duplicate requests |
| Overflow or unreadable QR | Explain the specific field or QR issue and retain edits |
| Expired session or changed entitlement | Recheck access and show the relevant sign-in/upgrade state |

Saving and publishing remain visible actions. Do not silently publish a private draft when someone requests a download. For offline mode, offer “Save and download” as an explicit action if desired; it must complete the save, receive the new revision, and then export that revision.

Use a filename such as `christopher-sabiti-print-package-r12-online.zip`. Inside, names may include the same base for convenient forwarding. Return all three files atomically; if any renderer fails, return an error instead of a partial package. One ZIP gives the recipient a single coherent download and avoids managing three independent browser download actions. The `fflate` project supports ZIP creation, including asynchronous and streaming APIs.[^1]

## QR mode and publication rules

Persist `qrMode: "dynamic" | "offline"` with default `"dynamic"`; label dynamic as **Online profile QR** in the interface. A field on card data is the smallest change, but it requires care because publication equality currently compares the whole data object. Normalize missing legacy defaults on both sides of comparison, and compare printable/contact content separately from export preferences. Otherwise adding a default can incorrectly make unchanged published cards appear out of date.

An alternative is a separate `export_settings` record field, which cleanly separates preference changes from public content but requires broader record and API changes. For the initial feature, a normalized optional data field is reasonable if its equality behavior is covered by tests. The server must resolve the mode; never trust a client-supplied QR image or URL.

| Saved situation | Resolved mode | Download rule |
|---|---|---|
| New or legacy card, no preference | Online | Require a matching published snapshot |
| Saved card explicitly Offline | Offline | Encode saved contact data as vCard |
| Saved card explicitly Online | Online | Encode canonical production profile URL |
| Online card unpublished or trashed | Online preference retained | Block export until restored/published |
| Offline card subsequently published | Offline preference retained | Publication does not overwrite the choice |
| Duplicated Online card | Online | New slug must be published first |

For Online, build the URL from the configured canonical site origin and the owned saved slug. Reject localhost, preview-deployment origins, and missing configuration in production. Existing printed online QR codes follow future published updates at that slug, but printed names and phone numbers remain static. Offline QR codes contain a fixed vCard snapshot; changing the website later cannot update or revoke that embedded contact data.

## Print geometry and scan quality

Use the requested **85.6 × 54 mm** landscape trim size as the first preset. Store sizes in millimetres and convert for each renderer: PDF points = mm × 72 / 25.4; raster pixels = mm × DPI / 25.4. This is a chosen product preset matching the attachment, not a claim that every card printer accepts identical dimensions.

| Preset | Trim | Outer size | Approximate raster at 300 DPI |
|---|---|---|---|
| Exact-size card | 85.6 × 54 mm | 85.6 × 54 mm | 1011 × 638 px |
| Proposed 3 mm bleed | 85.6 × 54 mm | 91.6 × 60 mm | 1082 × 709 px |

These raster dimensions are rounded; PDF dimensions should retain physical precision. Treat 3 mm bleed and a 3 mm inner safe zone as proposed starting settings for printer confirmation, not universal production requirements. Direct card printers and print shops can require different templates. Zebra documents dedicated CR80 card-printing workflows, reinforcing the need for a printer-specific preset rather than one generic bleed rule.[^2]

The flat PDFs must exclude shadows, labels, dimensions, hands, and mockup scenery. Extend background artwork through bleed where selected. Rounded corner clipping belongs in the mockup unless the printer specifically requests it in supplied artwork. Both sides should use the same orientation; do not mirror the back automatically. Duplex feed orientation must be verified with a physical proof.

Keep QR modules dark on a white field with a four-module quiet zone. DENSO WAVE specifies this quiet zone and relates physical QR size to module count and printer resolution.[^3] The existing margin of four is suitable, but resizing or clipping the result can undo it.

A practical starting front layout can reserve a 32 mm square including quiet zone. For a symbol with 97 modules per side, that leaves 32 / (97 + 8) = 0.305 mm per module, or about 3.6 printer dots at 300 DPI. This calculation illustrates density, not a scan guarantee. Longer offline vCards can create denser symbols; count modules before accepting the layout. Increase the QR region or request fewer embedded fields when necessary. Never truncate payload silently.

Prefer vector QR modules in PDFs. The installed `qrcode` package supports SVG generation and access to the encoded symbol; its existing use can be extended without replacing the encoder.[^4] Rasterize exported faces and decode the final QR with the existing `jsqr` dependency, then test physical proofs on multiple phones. Error correction does not compensate for illegible print scale or missing margins.

## Layout matching the reference

Use a fixed print layout rather than the responsive digital card. The front places the name above an underline, with the framed QR below; the back has a narrow accent strip, photo and name header, title and organization, two contact columns, social icons, and a lower personal-details band with the logo. Resolve the brand palette once so the frame, accent strip, and lower band stay consistent across all views.

| Reference element | Card source | Layout behavior |
|---|---|---|
| Two-line front name | `firstName`, `lastName` | Preserve spelling and credentials; wrap with measured bounds |
| Back header | Name, `title`, `organization` | Measured hierarchy with explicit line limits |
| Profile photo | `photo` | Circular crop; initials if absent |
| Left contacts | `phones`, `emails` | Remove empty rows; stable icon and text columns |
| Right contacts | `websites` | Display readable host/path; preserve complete QR contact data |
| Social row | `socials` | Render selected platform icons in stable order |
| Lower band | `location`, `role`, `tagline` | Fit text around the reserved logo area |
| Organization logo | `logo`, then brand fallback | Preserve aspect ratio |

The schema permits ten phones, ten emails, ten websites, and long role/tagline fields. They cannot all reliably fit this physical design. Add a print-specific contact selection with a visible overflow report. Online cards can direct recipients to the profile for remaining details. Offline cards should clearly distinguish fields printed on the surface from fields embedded in the QR.

Start with a proposed 7.5–8 point minimum for contact/body text, then validate with the selected printer. Do not keep shrinking text until everything technically fits. If content exceeds the available area, identify which rows need selection or shortening. Empty sections should collapse cleanly without inserting fictional contact details.

Embed fonts that cover the actual names and symbols. Test `PMP®`, accented names, long organization names, and unsupported scripts. The existing stored image resolution may be adequate for a small portrait but insufficient for a larger placed logo; effective PPI is pixel width divided by placed width in inches. Upscaling does not restore missing image detail.

## Reusable mockup

Preserve the supplied image as the visual reference, then construct a clean template with independently replaceable front and back surfaces. The supplied PNG is flattened; its existing card details cannot automatically become editable layers. Reusing it directly would leave old names or QR codes in some positions.

The template should contain a neutral background, large front and back slots, angled front and back slots, and the hand-held front slot. Store masks, corner coordinates, shadows, and foreground hand occlusion separately. Every slot receives artwork rendered from the same snapshot. Keep dimension annotations and the specification strip outside the print faces.

The most faithful version needs a prepared clean scene and perspective mapping for each angled surface. Sharp provides image compositing and affine transformations, but affine transforms alone are not a general four-corner perspective warp.[^5] Prototype a dedicated projective mapping step or a controlled scene renderer before committing to exact photorealistic replication. A simpler flat-and-rotated mockup is a fallback only if reduced fidelity is acceptable; it does not fully reproduce the attachment.

Use deterministic rendering for card text and QR placement. Generative artwork can help prepare a blank scene separately, but generating a new scene on every download risks inconsistent lettering and geometry. The QR and text must always be composited from actual card artwork.

Persist a template version such as `reference-v1` and its scene assets. Generate a high-resolution RGB PNG, proposed at 3072 × 2048 pixels. The mockup may retain selected material and finish labels as specifications, but cannot certify manufacturing thickness, finish, or print readiness. Show “Preview” or actual verified export properties where appropriate.

## Rendering architecture

Recommended pipeline: **owned saved record → normalized snapshot → QR payload and matrix → measured layout → front/back PDFs → mockup PNG → validation → ZIP**.

Create a shared layout model with positions, text runs, images, and colors in physical units. PDF and mockup renderers should consume this model. Avoid independently maintaining three templates with their own text-wrapping rules. Capture resolved colors, image identities, font version, QR mode, template version, print preset, and record revision in the snapshot.

| Approach | Assessment |
|---|---|
| Browser screenshot plus ZIP | Fast prototype; insufficient control over physical sizing, paid enforcement, and output consistency |
| Server browser rendering | Useful CSS fidelity and perspective preview; browser/font packaging and print color management still need validation |
| Shared layout with explicit PDF/image renderers | Recommended for fixed card geometry and deterministic production output; more initial layout work |
| External prepress service | Appropriate if certified printer-specific PDF/X is required; adds cost, integration, and data handling |

`pdf-lib` is a candidate for explicitly sized pages, embedded fonts, drawing operations, TrimBox, and BleedBox.[^6] Add it only after a spike proves the gradients, typography, image handling, and output requirements. Page-box support alone does not imply PDF/X compliance.

Use Sharp for raster composition and PNG metadata; it documents output density and ICC-profile handling.[^7] Use a ZIP library such as `fflate` for packaging. Pin reviewed dependency versions and record the lockfile. Keep large mockup assets and font processing server-side.

Do not label ordinary RGB PDFs or PNGs “CMYK ready.” Adobe documents output intents as a description of the intended print condition, and its PDF/X settings require appropriate output-intent information.[^8][^9] A commercial CMYK/PDF-X preset needs a printer-supplied profile, correct conversion, font embedding, and preflight. Offer a clearly named standard PDF preset first only if the intended printer accepts it; certified production output is a separate acceptance requirement.

## API, billing, and storage

Add a protected route such as `POST /api/cards/[slug]/print-package`. The request should contain the expected revision and an allowlisted preset/template selection. Fetch all card content and the persisted QR preference server-side. Check origin, current application session, ownership, deleted status, rate limit, effective entitlement, publication readiness, and revision before generating files.

Reuse `currentUser()`, `ownedRecord()`, `rateLimit()`, and the existing error conventions. Return 401 for missing session, 403 for plan denial, 404 for unavailable/non-owned cards, 409 for stale revisions or publication mismatch, and a field-specific validation response for layout problems. Return the ZIP with attachment disposition and private/no-store caching. Do not place private exports behind public CDN paths.

Introduce a capability such as `print_package_enabled` on plan configuration. Set Free false, Basic true, Premium true. Resolve it from the server's effective plan, not pricing-card copy, a browser flag, or an unfinished payment order. Extend the usage/capabilities response so the UI shows the same decision.

The existing `effective_plan` returns active unexpired subscriptions, then active trials, then Free. Recommended policy is to allow a trial of an eligible plan while the trial is active, consistent with this existing entitlement model. If access must require actual payment, use an explicit paid-subscription condition instead. This trial distinction is a product decision still to settle; it should not be hidden inside the renderer.

Recheck entitlement on every download, including cached ones. Past-due, canceled, and expired subscriptions follow the existing effective-plan fallback. Do not grant general administrator bypass without an explicit product rule. Billing restrictions should apply to the new package; the request does not call for removing existing Free exports.

A streaming response without persistent export storage is the simplest first implementation. For saved mockup previews or reuse, store exports privately with keys incorporating owner, card, revision, QR mode, template version, preset, resolved brand/assets, and renderer version. Do not overwrite an old revision's export with new content. Recheck that the revision is current before calling it the latest preview.

Supabase documents that service keys bypass storage RLS.[^10] Because this application uses a server admin client, route-level ownership checks are essential even when storage is private. Authorize card media by owner and known internal media IDs; do not accept arbitrary remote image fetches from request bodies. Use the app's existing internal identity model rather than assuming a browser-auth UID matches `users.id`.

## Delivery sequence and acceptance

First implement normalized QR persistence and billing capabilities. Verify legacy defaults, explicitly saved Offline cards, publication equality, duplicate behavior, and active-trial policy. This removes two foundational sources of inconsistent downloads.

Next build a renderer spike using the attached layout: front, back, dense offline QR, long names, and missing images. Inspect physical PDF boxes, embedded fonts, raster resolution, and decoded QR payload. Confirm the printer preset and color workflow before calling any output ready for production.

Then prepare the reusable mockup scene and replacement masks. Validate all five card placements against the same snapshot, including the hand-held front. Complete the ZIP endpoint and UI readiness states, followed by authenticated end-to-end checks and physical proofs.

| Acceptance area | Required evidence |
|---|---|
| Three-file delivery | ZIP opens and contains exactly two single-page PDFs and one PNG |
| Data consistency | All faces and mockup placements use the requested saved revision |
| Online default | New/legacy cards default Online; private cards do not gain broken downloadable QR codes |
| Offline persistence | Save, reload, publish, and duplicate preserve explicit selection |
| Publication | Unpublished edits cannot be exported as though they match the public profile |
| Billing | Free denied server-side; Basic/Premium allowed; trial/expiry tested |
| Ownership | Another authenticated account cannot export a card by changing its slug |
| QR | Final rasterized face decodes to exact intended URL or vCard; quiet zone remains intact |
| Print | Physical dimensions and preset page boxes verified; front/back orientation proofed |
| Overflow | Long/maximum input produces deliberate layout or actionable error, never invisible clipping |
| Mockup | No reference person's details survive as baked-in text on any card surface |
| Failure recovery | Missing media, font errors, renderer failures, and stale revision return no partial ZIP |
| Mobile | Package download and recovery behavior checked on iOS Safari and Android Chrome |

No runtime benchmark or printer proof was performed for this research. Implementation duration depends chiefly on exact perspective-scene fidelity and required color certification. The highest-value first milestone is a single reference-quality package generated from saved data, verified for dimensions, QR decoding, entitlement, and revision consistency.

## Sources

Primary documentation below was reviewed September 9, 2026. Undated project documentation describes capabilities, not a guarantee that a candidate library meets the entire proposed workflow.

[^1]: 101arrowz, [fflate repository and ZIP API documentation](https://github.com/101arrowz/fflate), undated living documentation. ZIP packaging capabilities.
[^2]: Zebra, [ZXP Series 3 user guide](https://www.zebra.cn/content/dam/support-dam/en/documentation/unrestricted/guide/product/zxpseries3-ug-en.pdf), manufacturer documentation, edition not independently verified. CR80 card-printing context.
[^3]: DENSO WAVE, [Point for determining the code area](https://www.qrcode.com/en/howto/code.html), undated. Quiet zone and physical module sizing.
[^4]: soldair, [node-qrcode documentation](https://github.com/soldair/node-qrcode), undated living documentation. QR encoding and SVG output.
[^5]: Sharp, [Compositing images](https://sharp.pixelplumbing.com/api-composite/) and [Image operations](https://sharp.pixelplumbing.com/api-operation/), undated living documentation. Composition and affine capabilities; perspective limitation is an architectural inference.
[^6]: PDF-LIB, [PDFPage API](https://pdf-lib.js.org/docs/api/classes/pdfpage), undated API documentation. Page drawing and trim/bleed box methods.
[^7]: Sharp, [Output options](https://sharp.pixelplumbing.com/api-output/), undated living documentation. Metadata density and ICC profiles.
[^8]: Adobe, [Output intents in PDFs](https://helpx.adobe.com/acrobat/using/output-intents-pdfs-acrobat-pro.html), updated February 26, 2026. Intended print conditions and profile handling.
[^9]: Adobe, [Adobe PDF settings overview](https://helpx.adobe.com/acrobat/desktop/create-documents/explore-advanced-conversion-settings/pdf-settings-overview.html), living documentation. Output-intent and font settings.
[^10]: Supabase, [Storage Access Control](https://supabase.com/docs/guides/storage/security/access-control), living documentation. RLS and service-key behavior. The changelog markdown endpoint could not be retrieved; no Supabase upgrade or new API dependency is proposed here.

Local evidence: `components/CardActions.tsx`, `components/Studio.tsx`, `components/CardPreview.tsx`, `components/SessionGuard.tsx`, `lib/types.ts`, `lib/validation.ts`, `lib/downloadQrCard.ts`, `lib/captureCard.ts`, `lib/qr.ts`, `lib/publication.ts`, `lib/records.ts`, `lib/media.ts`, `lib/billing/catalog.ts`, `lib/saas/types.ts`, `app/api/usage/route.ts`, `app/c/[slug]/page.tsx`, `supabase/migrations/20260906185005_commercial_controls.sql`, `package.json`, and `CLAUDE.md`. These are repository observations rather than external published sources; deployed configuration was not inspected.

Visual source: supplied `codex-clipboard-f937e70f-be22-4db0-b9a9-1efb57c5276e.png`, preserved as [mockup-reference.png](mockup-reference.png). Used for face naming, visual arrangement, and requested dimensions; not treated as a print certification or a source of reusable personal details.
