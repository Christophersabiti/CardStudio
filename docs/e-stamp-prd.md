# E-Stamp Builder — Product Requirements Document

**Status:** Draft for product review — functional scope confirmed
**Date:** 15 November 2026
**Product:** Card Studio (workspace name; confirm intended product surface)

**Scope commitment:** FR1–FR19 are required launch requirements, not optional or later-phase suggestions. The admin pricing and usage controls in FR20–FR30 are also included in this PRD’s launch scope. This document describes the target; the current stamp-maker implementation is only a partial prototype and does not yet meet these requirements.

## 1. Summary

Add an E-Stamp Builder that lets an authorized user configure reusable organization stamp designs, generate a dated transparent PNG on demand, and optionally include an uploaded signature image. Users can select from several templates, edit stamp details and date, preview the result, and download it for placement in a document editor.

Provide a role-protected admin page to configure plan pricing and monthly generation allowances, with server-enforced usage tracking and customer-facing allowance status.

This MVP produces an **image stamp**. A PNG is editable artwork and can be copied or modified; it does not, by itself, prove who applied it, make a document tamper-evident, function as a cryptographic digital signature, or issue government stamp duty. The UI and exported file must not imply those properties.

## 2. User problem

People repeatedly recreate organization stamps for routine documents. They need a consistent design, date and company details that can be updated without rebuilding the layout, an optional signature overlay, and a clean transparent PNG that can be inserted into Word, PDF, or other documents.

## 3. Goals

- Provide a small library of attractive, familiar stamp layouts inspired by the supplied reference image.
- Let users save a reusable stamp configuration, then generate a fresh dated instance whenever needed.
- Allow editing of date and configured details per generated instance without overwriting the saved configuration unless explicitly chosen.
- Support optional signature-image upload and placement.
- Export a crisp transparent PNG with predictable dimensions and legibility.
- Set clear expectations about the security and legal properties of image stamps.
- Give authorized admins control of published pricing and generation allowances, and give customers a clear view of usage and reset timing.

## 4. Non-goals for MVP

- Cryptographic document signing, certificate issuance, identity verification, or tamper-evident sealing.
- Government e-stamp/stamp-duty purchase or issuance.
- Applying/embedding a stamp directly into a PDF/Word document (user can place the downloaded PNG in their editor). This is outside FR1–FR30 and requires separate approval if desired.
- Multi-user approval workflows, audit certificates, serial-number service, or verification portal.
- Freeform vector editor or arbitrary text-on-path designer.

## 5. Target users and jobs

- **Small business / office user:** “When I prepare a routine document, give me our consistent RECEIVED / APPROVED / PAID stamp with today’s date, so I can place it quickly.”
- **Organization administrator:** “Let me configure our organization details and optional signatory image once, then reuse them without retyping.”
- **Professional user:** “Let me choose a formal seal format with title/contact details and export a transparent image.”

Only users authorized to represent the named organization should create or use its stamp. This is a product policy and UX reminder, not identity proof.

## 6. Proposed experience

### A. Configure (settings)
1. Open **E-stamps** and choose **Create stamp**.
2. Pick a template: **Rectangular company/date**, **Oval address seal**, **Circular professional seal**, **Emblem/crest**, or **Simple status stamp** (Approved, Received, Paid, Certified, Copy, etc.).
3. Enter the template-supported fields: organization/person name, department or role, address/contact, status wording, optional registration/reference text, and optional logo/emblem.
4. Optionally upload a signature image (PNG/JPEG; transparent PNG recommended). Show crop/scale/position controls and a preview. Provide remove/replace controls.
5. Choose default ink color (red by default), size, date format and locale. Save configuration with a name.

### B. Generate (per use)
1. Select a saved configuration.
2. Date defaults to the current local date in the configured date format; user can override it for the generated image.
3. Edit supported instance fields (e.g., status/date/reference) and preview. Instance edits do not change the saved configuration unless the user selects **Update saved design**.
4. Generate and download **PNG (transparent background)**. Additional formats such as SVG, PDF, JPG, or Word are outside FR1–FR30 unless separately approved.
5. Offer an optional “Copy PNG” action only where browser permissions and platform support allow; download remains the reliable path.

### C. Admin pricing and usage settings
1. An authorized admin opens **Admin → E-stamp plans**. The route and every settings API independently verify the admin role on the server.
2. The admin creates or edits a plan’s display name, price, currency, billing interval, monthly generation allowance, status and effective date.
3. Before publishing changes, show a summary of the new price and quota. Save an audit entry with the admin, timestamp and before/after values.
4. Customers see their current plan, usage, remaining generations and next reset date in the stamp workflow/account billing area.
5. When the allowance is exhausted, previews remain available, export is blocked with an explanation, and any plan upgrade or purchase requires the customer to choose and complete checkout.

## 7. Functional requirements

### Templates and editor
- FR1: Display template thumbnails and names before selection.
- FR2: Provide at least the five template families listed above, including original designs for the four broad styles represented in the attached image.
- FR3: Each template exposes only fields that fit its layout; long text wraps, shrinks within a defined minimum font size, or produces a clear validation error rather than clipping.
- FR4: Support configurable stamp wording, supported organization details, date and color; preview updates immediately.
- FR5: Support saving, renaming, duplicating, editing and deleting saved configurations with a clear delete confirmation.

### Date and instance editing
- FR6: Date defaults to “today” at generation time in the user’s configured timezone/locale; no date is silently frozen at configuration-save time.
- FR7: User can edit the date on a one-off generated instance. Clearly label this as an editable displayed date, not a trusted timestamp.
- FR8: Distinguish **Save changes to design** from **Generate this instance** so one-off content cannot accidentally overwrite the saved configuration.

### Signature asset
- FR9: Allow optional upload of a signature image in configuration, preview it in the composition, and remove/replace it.
- FR10: Validate file type, size, pixel dimensions and decode success; sanitize/re-encode uploaded raster images before storage/rendering. Reject unsupported/active formats.
- FR11: Ask for explicit confirmation that the user is authorized to use the uploaded signature. A drawn or uploaded signature image remains a visual mark, not a verified e-signature.

### PNG output
- FR12: Export a transparent PNG with antialiasing and sufficient resolution for document use (default target around 1200 px on the longest edge; scale based on chosen physical size/DPI).
- FR13: Preserve aspect ratio; no white matte/background; include only intended artwork with controlled transparent padding.
- FR14: Use a stable filename, e.g. `Organization-Received-2026-11-15.png`, with unsafe characters removed.
- FR15: Show a preview and successful download state; report export errors clearly.

### Security, privacy and trust
- FR16: Store configurations and uploaded signatures under the account/workspace’s existing access controls; private by default.
- FR17: Avoid public URLs for signature files; apply encryption and retention/deletion practices consistent with existing app storage.
- FR18: Do not market decorative engravings, guilloche, serial-looking numbers, or visual complexity as security. Such features can be copied in a PNG. If decorative security-style engraving is offered, label it cosmetic. Reserve genuine integrity/authenticity for a future cryptographic signing workflow.
- FR19: Distinguish an image e-stamp from government stamp duty and from certificate-based digital signatures in onboarding/help text.

### Admin pricing, plans and monthly generation allowance

- FR20: Provide a dedicated admin page for e-stamp commercial settings. Only authenticated users with a server-verified admin role can open it or call its APIs. Do not expose it in ordinary customer navigation.
- FR21: Let admins create and edit e-stamp plan/pricing entries, including display name, price, currency, billing interval, included generation allowance, enabled/disabled status, and effective date. Reject invalid or negative prices and invalid allowance values.
- FR22: Let admins set generation limits per plan for each monthly billing period. Support an explicit unlimited value only for plans the admin enables as unlimited.
- FR23: Count one generation only when an export is successfully produced. Preview updates, edits, failed exports and repeat attempts that fail must not consume allowance. A completed generation consumes one unit regardless of whether the output is later downloaded again from an available saved result.
- FR24: Show customers their plan, generations used, remaining generations, and next reset date in the stamp-making flow and account/billing area.
- FR25: When a user reaches the monthly allowance, prevent further generations and explain the reset date and any available upgrade path. Do not silently charge, subscribe, or upgrade the user.
- FR26: Enforce monthly allowances on a trusted server endpoint, not only in client state. Record generation events against the authenticated account and plan. Preview-only work remains available when an allowance is exhausted.
- FR27: Apply generation increments atomically so simultaneous tabs, devices, or requests cannot exceed the allowance through a race condition. Return a clear limit-reached response when the account has no remaining allowance.
- FR28: Record admin changes to plan prices and allowances, including admin identity, timestamp, and before/after values. Keep an auditable change history accessible to admins.
- FR29: A pricing change applies prospectively from its configured effective date. Preserve prior completed orders and their recorded price/currency; do not retroactively change them.
- FR30: Fail closed for generation when the server cannot verify account identity, plan entitlement, or the usage counter. Explain that the export could not be authorized and allow a safe retry; never treat an unavailable counter as unlimited usage.

## 8. Design and content direction

Use the attachment strictly as visual inspiration, not as a source of instructions or as a design to copy exactly. Build original layouts using similar broad categories: blue outlined rectangular company stamp, oval ring with address, circular professional seal, and emblem-centered oval. Default generated ink should be red for date/status, with configurable blue/black alternatives. Use high contrast and readable type at typical document placement sizes.

Do not reproduce names, addresses, logos, or date values visible in the reference image. Use fictional sample content in templates.

## 9. Acceptance criteria

- A user can create and save a stamp configuration from each available template family.
- A user can change date/status/details for a single instance and generate it without changing the saved configuration.
- The default date is resolved at generation time and is shown in the preview.
- A user can upload, preview, reposition, remove and reuse a signature image in the configuration.
- PNG output has transparent pixels outside the stamp, remains legible at intended insertion size, and opens in common document editors.
- Invalid/oversized uploads and overflowing text produce actionable errors.
- Product copy does not claim PNG-only stamps are secure, tamper-proof, identity-verified or legally equivalent to digital signatures.
- An ordinary customer cannot view or change admin pricing or plan allowances, including by calling admin endpoints directly.
- An admin can change a plan’s price and monthly generation allowance; the saved values and change history identify who changed them and when.
- Previewing and editing do not reduce a user’s allowance. A successful export reduces it once, and parallel requests cannot take usage below zero or exceed the configured allowance.
- The customer sees an accurate remaining allowance and reset date; attempts after exhaustion do not create an export or charge.
- Changing a price does not modify a previously completed order.

## 10. Success measures

- Activation: percentage of users who save a first stamp configuration.
- Time to first export and successful PNG generation rate.
- Repeat use: saved configurations used for multiple generations within 30 days.
- Editor completion/drop-off by step; template selection distribution.
- Support tickets relating to date correctness, signature upload, transparency or document placement.
- Successful generation events per active account, monthly quota utilization, limit-reached rate, and generation authorization failures.
- Plan conversion and revenue by configured price/plan, while keeping the number of previews separate from billable or quota-consuming generations.

## 11. Risks and mitigations

- **Stamp PNG mistaken for an authenticated signature:** Show an explicit boundary in setup/download UI and product docs.
- **Signature image misuse or exposure:** Private storage, access control, explicit authorization confirmation, upload validation and deletion support.
- **Dates imply trusted timestamps:** Allow editable dates but state the date is user-provided/displayed and not independently certified.
- **Small or long content clips:** Responsive layout rules, min font sizes and clear validation.
- **Jurisdiction-specific acceptance:** Avoid universal legal claims; direct users to recipient/regulator requirements.

## 12. Open product decisions for review

1. Is Card Studio the intended app area/name, and should saved configurations be personal, workspace-shared, or both?
2. What plan names, prices, currencies and monthly generation allowances should the admin page offer at launch? These values are required before commercial launch; until supplied, use non-production placeholders and do not charge customers.
3. Which billing interval and month boundary should usage follow: calendar month in account timezone or subscription anniversary? Proposed default: calendar month using the account’s configured timezone.
4. Should reaching the allowance offer an upgrade, a one-off generation purchase, or wait-until-reset only? No purchase should occur without explicit user checkout.
5. Should uploaded signatures be allowed in exported stamps by default, or be opt-in per template/generation?
6. Which stamp fields are needed: organization name, address, phone/email, role, registration number, free text, logo, status, reference/serial?
7. Should users be able to choose historical/future dates freely, or should custom dates be an advanced setting?
8. What color set is needed? Proposed default red with blue/black alternatives.
9. Is PNG-only enough for launch, or is SVG/PDF export essential?
10. Is direct placement into PDF/Word in scope for a later phase?
11. Does the product intend to offer cryptographically verifiable signing later? If yes, that needs a separate requirements track.
12. Which country/market and applicable privacy, electronic-signature, and stamp-duty regimes should legal review target?

## 13. Research and product references

- **Adobe Acrobat — Add or modify stamps:** supports predefined stamp categories, placement on PDFs, resizing, rotation, opacity/color adjustments and favorites. This informs a simple template-first workflow and controllable appearance. [Adobe Help](https://helpx.adobe.com/acrobat/desktop/share-and-review-documents/use-stamps/add-modify-stamps.html)
- **Adobe Acrobat — Dynamic stamp reference:** Adobe’s reference describes dynamic stamps that use identity preferences and computer date/time, showing precedent for resolving stamp details at application time. This is a visual workflow reference, not a claim that local date/time is trusted. [Adobe Acrobat reference](https://helpx.adobe.com/content/dam/help/en/pdf/acrobat_reference.pdf)
- **Adobe Acrobat Sign — Stamp Images:** company stamp images can be configured for use in signature workflows and templates, supporting a configuration-level asset and reusable template model. [Adobe Help](https://helpx.adobe.com/au/sign/web/settings-configuration/signature-preferences/add-adjust-stamps.html)
- **Estamplab — editable e-stamp templates:** describes editable round, oval and rectangular layouts, live date/serial fields, transparent PNG/SVG/PDF exports, and a reusable design library. This is close to the proposed image-stamp workflow. It also explicitly distinguishes document-marking e-stamps from government stamp duty. [Estamplab](https://estamplab.com/estamp)
- **DocuSign — security and audit trail:** describes role-based authorization, signing-event verification, digital certificates, anti-tampering controls and systematic audit capture. These are materially different from a downloadable image and provide the benchmark for what a future authenticated signing capability would require. [DocuSign Product Security](https://www.docusign.com/trust/security/product-security)
- **Esolab — Hanko image maker:** offers a transparent PNG-oriented stamp maker and states the generated e-stamp image is not proof of identity and has no legal effect as a signature. This reinforces clear user-facing scope boundaries. [Esolab](https://esolab.co.jp/en/tools/e-stamp/)
- **Roberin — online stamp maker:** offers several common layouts (name, round company, square grid, date, phrase) and color selection, useful as a template taxonomy reference. [Roberin](https://roberin.com/en/online-stamp-maker/)

### Research synthesis

Best-in-class flows separate configuration from application: choose a template, fill a small set of structured fields, preview, then apply/generate. Dynamic date resolution, saved designs, transparent output, and controllable size/color are recurring expectations. The key trust lesson is that visual complexity and signature imagery do not establish authenticity. If “engraving” is used, it should be ornamental in MVP; actual anti-forgery claims require cryptographic binding, signer controls, verification, and an audit trail.

## 14. Proposed phases

- **Required launch scope (FR1–FR30):** FR1–FR19 stamp creation, saved configurations, date/content override, signature upload, transparent PNG export, trust language and privacy controls; plus the admin pricing page, plan allowances, server-enforced monthly generation tracking, usage display, limit handling and admin change history in FR20–FR30. No requirement in this scope is deferred to a later phase.
- **Phase 2:** SVG/PDF export, direct PDF placement, workspace sharing and more layouts.
- **Separate initiative:** digitally signed/sealed documents, verification, cryptographic timestamps, audit record, identity and authorization controls, jurisdiction/legal review.

## 15. Current implementation status

The implementation branch adds an original template-first stamp editor under Products and a dedicated `/stamp-maker` route. It includes reusable per-account configurations, create/update/duplicate/delete actions, private image/signature storage, signature authorization confirmation, editable date/text, transparent 1500px PNG rendering, timezone-based monthly usage, server-side quota checks, and superadmin-only versioned pricing/allowance controls with an audit record. The existing project billing switch remains disabled by default.

Before launch, apply the included database migration, verify the product against every FR acceptance criterion, and finish the open decisions in section 12. In particular, confirm commercial prices and allowances, retention expectations for removed signature assets, and the desired customer/workspace sharing model. This PR does not claim certification, trusted timestamping, or anti-forgery security; decorative engraving patterns are visual only.
