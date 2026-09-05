# Card Studio review and phased enhancement roadmap

Reviewed 5 September 2026. Status: recommendation only; application implementation has not started.

## Recommendation

Card Studio is a credible card-creation MVP. Its strongest starting points are browser-based creation, live preview, downloadable PNG/vCard files, direct contact QR codes, and CSV group sharing. It needs ownership, reliable publishing, and a better mobile recipient experience before broad release.

Positioning hypothesis: a simple branded contact-sharing service for associations, SMEs, and event teams, with particular attention to mobile and low-connectivity use. The existing PMI Uganda and Sabtech presets and group workflow support exploring this direction; they do not establish customer demand. Validate it with five individual users and two organization administrators before committing to later phases.

Keep the existing stack. A framework rewrite would not address the main product gaps.

## Review scope and evidence

- Inspected source for creation, public pages, previews, CSV parsing, QR/vCard generation, exports, and branding.
- Opened the local app and inspected desktop and 390 × 844 mobile layouts, including the group empty state.
- TypeScript validation passed. Lint passed with one existing custom-font warning in `app/layout.tsx`.
- Standard npm scripts encountered executable permission errors in `node_modules/.bin`; direct Node invocation worked. Local server startup required sandbox escalation and then succeeded.
- No production build, production database save, real-device contact import, camera scan, download round trip, or load test was completed. This is a product/capability benchmark, not a measured speed benchmark or full security audit.
- Competitor capabilities below come from current official pages, not hands-on trials. Features may depend on plan. No vendor performance or conversion claims are treated as independently verified.

## Benchmark against existing products

| Product | Relevant documented capabilities | Card Studio today | Enhancement implication |
| --- | --- | --- | --- |
| Blinq | Admin-managed team cards, templates, bulk upload, editable cards, recipient contact exchange | CSV creates a shared group contact bundle; no managed individual team-card lifecycle | Add a dashboard, stable editable links, ownership, then organization administration. [Source](https://support.blinq.me/en/articles/68062-blinq-business-team-cards) |
| HiHello | Business cards, email signatures, virtual backgrounds, branding and lead capture | A single card design with deployment-level brand presets and per-card logo uploads | Introduce a small template set and reusable organization branding before adding more distribution assets. [Source](https://www.hihello.com/business) |
| Popl | Lead capture forms, badge/business-card scanning, CSV lead import, individual and team lead views | Contact distribution only; no incoming lead workflow | Add optional contact exchange and a basic lead inbox after publishing and access controls. Defer scanners. [Source](https://support.popl.co/en/articles/9621419-lead-management) |
| Wave Connect | Advertises free individual cards with Apple Wallet, analytics, and unlimited sharing | PNG/QR/vCard downloads and share links; view counters have no user dashboard | Basic sharing alone is a weak paid differentiator. Compete on organization/group usefulness and support. [Source](https://wavecnct.com/individuals) |

Blinq also documents Apple/Google Wallet and personal email signatures in its individual offering. These are useful reference features, but should follow reliable core sharing. [Source](https://support.blinq.me/en/articles/76397-free-vs-premium-what-s-included)

## Findings, prioritized

| Priority | Finding and evidence | User consequence | Recommended change |
| --- | --- | --- | --- |
| Critical before broad rollout | Create endpoints are unauthenticated; source shows no rate limiting and only shallow validation (`app/api/cards/route.ts`, `app/api/groups/route.ts`). Group validation calls `data.name.trim()` before verifying its type. | Malformed requests can produce server errors; public writes can be abused. | Runtime schemas, field/array limits, actual request-byte limits, safe URL protocols, rate limiting, generic external errors, and operational logging. Verify any hosting-layer controls separately. |
| High | No ownership, dashboard, editing, unpublishing, or deletion flow. `lib/cards.ts` and `lib/groups.ts` create a new slug on each save. | Users cannot maintain published information or revoke a shared group. Repeated saves create additional records. | Owner-controlled lifecycle and updates at a stable URL; explicit draft and published states. |
| High | `components/Studio.tsx` retains the old share link when the editor changes; group QR remains tied to the saved group. | A newly edited preview can disagree with the destination users share. | Show unsaved changes; distinguish Update from Publish; bind exports and share actions to the intended version. |
| High | Single-card QRs contain raw vCard data, including on the public page. QR-generation failures clear the image without explanation. | Already exported QRs cannot reflect later edits; large contact payloads risk failure or difficult scanning. | Offer an explicit dynamic profile QR and an offline contact QR; explain tradeoffs and show capacity/errors. Existing offline codes remain snapshots. |
| High | Public-facing card component displays phones, email, and website as text; only social profiles are links (`components/CardPreview.tsx`). | Recipients cannot tap to call, email, or open the website. | Mobile profile with Call, WhatsApp, Email, Website, and Save contact actions. |
| High | Mobile inspection showed the tall preview and export/publish actions before the first editing fields. | Users must scroll substantially before starting their own card. | Edit/Preview tabs or a compact preview; one clear next action per stage. |
| High | Group URLs expose the downloadable group; no visibility, expiry, or consent workflow exists. | A forwarded link distributes the full roster. | Explicit publication notice and authorized membership sharing, unpublish/revoke, optional protected access and expiry. An unlisted URL is not access control. |
| Medium | Desktop card has small contact text, dense QR, and crowded brand/personal-details heading. Inputs often lack associated labels; social controls depend on placeholders. | Lower readability and keyboard/screen-reader usability. | Larger recipient text, separate logo space, clear focus states, associated labels, accessible upload buttons, and contrast checks. |
| Medium | Preview shows at most three phones, one email, and one website, while vCard exports can contain more. | Users can mistake a condensed design for the complete contact record. | Show all details on the public profile and explain compact image limits. |
| Medium | CSV parser splits lines before interpreting quotes; no mapping, duplicate review, downloadable sample, or row correction workflow. | Quoted multiline cells break; correcting imports requires editing and uploading again. | Robust parser, template CSV, mapping, row errors and duplicate review; add row correction in the team phase. |
| Medium | PNG export captures the responsive preview element, and profile/logo images are stored inline in card data. | Export layout depends on viewport; large images increase storage and page weight. | Fixed export layouts separate from mobile profile; managed image storage with upload validation. |
| Medium | View counters increment during page rendering; no event dashboard exists. | Counts cannot establish unique visitors, scans, leads, or successful contact imports. | Define and measure views, share actions, contact-download requests and lead submissions separately; filter obvious bots. |

## Phased delivery plan

Effort ranges are planning estimates for one experienced full-stack developer with part-time design/QA support, not commitments. They include focused validation but exclude procurement and lengthy customer-feedback cycles. Complete each phase's exit gate before expanding scope.

### Phase 0 — Stabilize the current MVP

Estimated effort: 3–5 working days. Dependency: none. Priority: immediate.

- Add request schemas, bounded payloads, URL validation, rate limiting and safe errors for cards and groups.
- Mark unsaved changes and prevent silently sharing a stale group snapshot.
- Surface QR errors; explain offline QR snapshots and public group exposure.
- Fix label associations, copy feedback, disabled export states, and actionable errors.
- Audit installed dependencies against current vendor advisories and repair local script execution as needed.

Exit gate: malformed/oversized requests fail predictably; stale-link behavior is explicit; QR errors are visible; representative contact files and exported QR images are checked on real iPhone and Android devices. Document group-import limitations by device instead of promising universal one-step import.

### Phase 1 — Ownership and dependable publishing

Estimated effort: 8–12 working days. Dependency: Phase 0.

- Add account sign-in, a My Cards dashboard, and ownership for both cards and groups.
- Support create, edit, duplicate, publish, unpublish and delete with appropriate recovery/confirmation behavior.
- Update existing cards at stable URLs. Make dynamic profile QR the default after publishing; retain offline contact QR as an explicit export option.
- Add validated image storage and clear draft/saved/published states.
- Plan treatment of existing anonymous cards: verify ownership before claims; never allow takeover using only a public slug. Preserve existing URLs during migration and retain rollback capability.

Exit gate: a user can create, sign out, return, edit and revoke a card; another account cannot modify it. A previously downloaded dynamic QR opens the updated profile. Revocation blocks future hosted access but cannot erase contact files already downloaded.

### Phase 2 — Mobile experience and everyday sharing

Estimated effort: 6–10 working days. Dependency: Phase 1 for the full publishing journey.

- Build a short Identity → Contact → Design → Publish journey with mobile Edit/Preview switching.
- Use a dedicated recipient profile with large actions, complete details, and clear Save contact guidance.
- Add native sharing with copy-link fallback, WhatsApp sharing, international phone formatting, and share-preview metadata.
- Offer three purposeful layouts: professional, association/member, and event/networking; include image cropping and reusable colors.
- Generate consistent PNG exports from a fixed layout; move Copy vCard into an advanced menu.

Exit gate: in a five-person usability pilot, at least four users create and share a valid card unaided within three minutes. This is a proposed target, not an observed result. Verify keyboard operation, common mobile widths, long names, dark mode, and real-device sharing/import behavior.

### Phase 3 — Organization and group value

Estimated effort: 10–15 working days. Dependency: Phases 1–2.

- Add organization workspaces, administrator/member roles, reusable brand templates and controlled brand fields.
- Distinguish bulk creation of individual team cards from a shared directory/contact bundle.
- Upgrade CSV import with mapping, validation, duplicate review, correction and clear partial-import reporting.
- Add directory search, selected-member downloads, member removal, and optional protected/expiring groups.
- Provide basic usage reporting with clearly defined events and organization boundaries.

Exit gate: an administrator can import a representative 100-member roster, resolve errors, update branding and remove a member without recreating remaining links. Verify cross-organization isolation and protected access for pages and download endpoints.

### Phase 4 — Growth features, selected by pilot demand

Estimated effort: 10–20+ working days for a selected subset. Dependency: working organization pilot and stable event definitions.

- Optional contact-exchange form with consent, lead inbox, notes and CSV export.
- Email signatures and Apple/Google Wallet passes; investigate issuer/certificate and update requirements before committing dates.
- One validated CRM integration or webhook with retries and deduplication, selected from customer demand.
- Custom domains and paid organization plans once support cost and willingness to pay are understood.

Exit gate: pilot organizations demonstrate repeated use and willingness to pay. For any CRM integration, verify consent, deduplication, retries and failure visibility before launch. Measure lead submissions and follow-up outcomes, not only page views.

## Scope to defer

Defer native mobile apps, proprietary NFC hardware, AI bio generation, badge/OCR scanning, a template marketplace and multiple CRM integrations. These add cost before the current publication and recipient journeys are dependable. NFC can later point to the same stable profile URL without requiring an initial hardware business.

## Proposed decision

Approve Phase 0 and Phase 1 as the first implementation scope, with Phase 2 next. Reassess Phase 3 with organization pilot feedback. Treat Phase 4 as a menu of demand-led investments rather than a requirement to match every competitor.

Only this review document was added; application source was not changed.
