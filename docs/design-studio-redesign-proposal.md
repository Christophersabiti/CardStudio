# Design Studio redesign — research, audit and proposal

Status: **approved 25 Nov 2026 and implemented** — see `docs/design-library-release.md`. Nothing in this proposal changes production data, the database
schema or any existing API. The reviewable prototype runs entirely on mock data at
`/prototype/studio`.

Date: 25 November 2026 · Branch: `feat/navigation-account-admin-portal`

---

## 1. Existing application audit

### Architecture (keep it)

| Layer | What exists today | Verdict |
| --- | --- | --- |
| Framework | Next.js 16 App Router, React 19, TypeScript, Tailwind + hand-written per-product CSS | Keep |
| Auth | Clerk → `requireUser()` → internal UUID; admin Supabase client filtered by `owner_id` | Keep. Every new asset route reuses it unchanged |
| Data | Supabase Postgres, private Storage, shared rate limiter, revision columns, soft delete | Keep. Fits a unified asset index well |
| Rendering | `CardPreview` (HTML), `StampSvg` (SVG), `qrcode` (canvas/SVG), `signatureHtml` (table HTML), `pdf-lib` + `sharp` print package | Keep and reuse in the library thumbnails and preview |
| Export | `saveCardAsPng` (html-to-image), `/api/stamps/export` (sharp 1500px PNG), `/api/qr-codes/[slug]/export`, print package ZIP | Keep; surface from one shared Download menu |

### Where each product's designs live today

| Product | Storage | Has a user-facing name? | Library | Search | Rename | Duplicate | Favourite |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business card | `cards` (`data` / `published_data`) | No: derived from person's name | `/dashboard` table | Yes (`search_owned_cards`) | No | Yes | No |
| Team contacts | `groups` + `group_cards` | Group name doubles as label | Mixed into `/dashboard` | Partly | No | No | No |
| QR code | `qr_codes` (`title`, `type`) | Title doubles as printed caption | `/dashboard/qr` | No | Via editor only | No | No |
| E-stamp | `stamp_designs` (`name` = `design.title`) | Name = template name by default | Inside the editor's side panel | No | Via a text field | Yes | No |
| Email signature | **Not persisted** (component state only) | No | None | No | No | No | No |
| Print package | Generated on demand from a published card | No | None | No | No | No | No |

### Problems that make it feel static and disconnected

1. **No single place to find "my stuff".** Cards live on `/dashboard`, QR codes on `/dashboard/qr`,
   stamps inside the stamp editor, signatures nowhere. Users must remember which tool they used.
2. **Broken saved-stamp list (screenshot 1).** `.stamp-saved button{width:100%}` applies to all
   three buttons in each `.stamp-saved-row`, and the row has no layout rule, so *Load*, *Duplicate*
   and *×* render as three full-width rows. Four rows of "Director rectangle" are
   indistinguishable because the saved name defaults to the template name and there is no
   thumbnail or date.
3. **Asset name and printed content are conflated.** Stamp `name` is written from `design.title`;
   QR `title` is also the label printed under the code. You can't call something "Director
   Approval Stamp – Uganda" without that text leaking into the output.
4. **Email signatures vanish on refresh.** No persistence at all.
5. **Templates and saved designs are mixed.** The stamp editor's template gallery and saved list
   sit side by side with the same button style; applying a template silently overwrites the
   working design's title.
6. **Inconsistent editor layouts.** Stamp uses a three-column studio; card uses a two-column
   form/preview; QR uses a wizard; signature uses a long single page. Labels for the same action
   differ ("Save design", "Save draft", "Save changes").
7. **Preview is decorative in places.** No zoom, no "on a document" or "in an email" context, no
   transparent-background toggle outside stamps, no indication of print dimensions.
8. **Create hub (screenshot 2) is a launcher only.** It can start a new thing but never offers
   "continue where you left off" or "use one of your saved designs".

### What works and must be preserved

- Ownership model, revision checks, soft delete/Trash and publication invariants (`data` vs
  `published_data`).
- Stamp renderer, server-side PNG export with outlined text, signature-authorisation prompt.
- QR quiet zone and named PNG export; dynamic vs offline QR labelling rules.
- Product colours from `ProductIcon` (card blue, QR green, team orange, signature violet,
  stamp red, print slate) — the prototype reuses them as category accents.

---

## 2. Platform benchmark

Sources were each vendor's help centre or support articles where available (see §9).
Where a feature could not be confirmed it is marked "not confirmed".

| Pattern | Canva | DocuSign | QR Code Generator PRO | Blinq / HiHello | Takeaway for us |
| --- | --- | --- | --- | --- | --- |
| Create new | "Create a design" → type → template or blank | Profile → Stamps → create or upload | Wizard: type → content → design | Dashboard → "Create email signature" | **Product → template → editor**, always one obvious button |
| Organise | Projects, folders, Recents, Starred section | Stamps tied to user profile; company stamps for admins | Folders and labels | Per-card; HiHello ties signatures to a brand profile | **One library + category filter + Favourites**; folders later |
| Search | Search scoped to all content; filter by type, owner, date; sort by relevance / edited / name | Not confirmed | Not confirmed | Not confirmed | **Search across names, type and content**, plus sort |
| Rename | Click title in editor toolbar *or* under the thumbnail | — | Rename supported | — | **Inline rename in both places** |
| Duplicate | Available (menu path not confirmed in docs) | — | Not confirmed | — | **Duplicate in card menu and editor** |
| Preview | Full-screen present mode | Stamp placed on the document | Live preview with scan test | Live signature preview | **Context previews**: on document, in an email, on a phone |
| Download | Format picker (PNG, PDF, SVG …) with size options | — | JPG, PNG, SVG, EPS | Copy-paste signature HTML | **One Download menu per product** listing only valid formats |
| Templates vs mine | Template gallery is visually separate from Projects | — | — | HiHello: five signature styles | **Separate "Templates" tab; template cards labelled "Template"** |
| Legal caution | — | Stamp image ≠ electronic seal; visible stamps can be copied | — | — | Keep our "visual mark, not a verified e-signature" wording |

Patterns adopted:

- **Canva's dual rename** (editor title + thumbnail caption) and **Starred** section → our
  inline rename and Favourites view.
- **Canva's search scoped to everything** with type/date filters and name/edited sort.
- **QR PRO's labels**: each QR card shows its *purpose* (Website, WhatsApp, Event…) as a chip.
- **DocuSign's separation** of the stamp *identity* (profile asset) from where it is applied →
  our asset name vs stamp text, and the "Preview on document" surface.
- **HiHello's brand profile idea** → later phase: one brand kit feeding card, signature, stamp
  colours. Not in scope for this redesign.

Patterns rejected: deep folder trees (too heavy for our typical user with 5–40 assets),
modal-heavy wizards (we keep editing in one page with progressive disclosure).

---

## 3. Proposed UX structure

### Navigation

```
Header  Create ▾ | My designs | Templates | Help ▾ | Account
                    │
                    ├─ All designs   (default, sorted by Last edited)
                    ├─ Favourites
                    ├─ Recent        (opened or edited in last 14 days)
                    └─ Trash
```

- "My cards" and "My QR codes" collapse into **My designs**, filtered by category chip.
  Their old URLs redirect to `/designs?type=card` and `/designs?type=qr`.
- **Create** keeps today's six tiles, and adds a "Continue editing" strip with the three most
  recent designs.

### Unified workflow (all six products)

1. **Choose a product** (Create menu or "New design").
2. **Choose a template** — or *Start blank*. Templates show a "Template" badge and never
   appear in My designs.
3. **Name it** — prefilled with a meaningful suggestion (e.g. "Director approval stamp"),
   editable, separate from what is printed.
4. **Customise** in the shared three-panel editor.
5. **Preview** in context (zoom, transparent, document/email/phone surface).
6. **Save** → lands in My designs with a thumbnail.
7. **Reuse** — edit, duplicate, rename, favourite, preview, download, delete (to Trash) from
   either the library card menu or the editor.

### Library

- Search box (name, category, purpose, printed text, person/company) with `/` shortcut.
- Category chips with counts: All · Business cards · QR codes · Team contacts · Email
  signatures · E-stamps · Print packages.
- Sort: Last edited · Date created · Name A–Z. Grid / list toggle (list shows the table the
  brief describes).
- **Asset card**: live thumbnail, name (double-click to rename), category chip with product
  colour, purpose/status chip (Published, Draft, Dynamic, Transparent PNG…), "Edited 3 days
  ago", star, overflow menu (Open, Preview, Rename, Duplicate, Download, Move to Trash).
- Delete asks for confirmation, moves to Trash, and the toast offers **Undo**.
- Empty states per filter with a "Create one" call to action.

### Editor (shared shell, product-specific panels)

| Left: controls | Centre: live preview | Right: details & export |
| --- | --- | --- |
| Collapsible sections relevant to the product only (Content, Style, Advanced) | Zoom −/+/fit, surface toggle, transparent toggle, front/profile toggle | Asset name (inline), category, template origin, created/edited, save state, export format & size, Save / Duplicate / Download |

On tablets the right panel folds under the preview; on phones the editor becomes three tabs
(Edit · Preview · Details) with a sticky Save bar.

### E-stamp specifics

- **Asset name** ("Director Approval Stamp – Uganda") and **Stamp text** (top arc, centre
  lines, bottom arc) are separate fields in separate sections.
- Library thumbnail renders the real stamp, so four "Director" stamps are distinguishable by
  shape, colour and text, plus their names and dates.
- Preview surfaces: transparent checkerboard · on a white document · on a scanned letter.
- Date and serial number are toggles that insert/remove elements, not free text the user must
  remember to update.

### Product specifics in brief

- **Business card**: template, people/company fields, photo/logo, colour, orientation; preview
  card and profile; PNG download, vCard, publish status chip.
- **QR code**: purpose picker (Website, WhatsApp, Contact, Event, Location, Wi-Fi, Email,
  Phone, Text); colour, logo, caption; scan-ready check; PNG/SVG download.
- **Team contacts**: team name, member list with search/add/remove; directory preview.
- **Email signature**: layout, colour, font, contact and social fields; preview inside a
  realistic email; Copy signature + download .html. **Becomes persisted for the first time.**
- **Print package**: pick a source card + components (card, QR sheet, stamp); sheet preview with
  dimensions; download individual files or the whole ZIP.

---

## 4. Proposed technical architecture

### Recommendation: a thin `assets` index, not a rewrite

Keep the product tables (they carry product-specific invariants such as publication and
dynamic QR redirects). Add one owner-scoped index table that every product writes to, so the
library reads one query.

```sql
create table public.design_assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.users(id) on delete cascade,
  kind         text not null check (kind in ('card','group','qr','signature','stamp','print_package')),
  source_id    uuid,                      -- row in cards/groups/qr_codes/stamp_designs, null for signature/print
  name         text not null check (length(name) between 1 and 120),   -- asset label, never printed
  template_key text,
  search_text  text not null default '',  -- printed text, purpose, person/company (for search)
  meta         jsonb not null default '{}',  -- purpose, status, dimensions for chips
  thumbnail_media_id uuid references public.card_studio_media(id),
  favorite     boolean not null default false,
  last_opened_at timestamptz,
  revision     integer not null default 1,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  deleted_at   timestamptz
);
create index on public.design_assets(owner_id, updated_at desc) where deleted_at is null;
create index on public.design_assets using gin (to_tsvector('simple', name || ' ' || search_text));
-- RLS enabled; service_role only, matching stamp_designs.
```

- New `signature_designs` table (same shape as `stamp_designs`) so signatures persist.
- `print_package` assets store `{ cardId, components[] }` in `meta` and render on demand
  through the existing print service.
- Stamp: stop writing `name` from `design.title`; add `design.label` migration path so old
  rows keep their name.
- QR: add `name` column; `title` stays the printed caption.
- Backfill: one migration inserts index rows for existing cards, groups, QR codes and stamps.
- API: `GET /api/assets?type&q&sort&view` (list), `PATCH /api/assets/[id]` (rename, favourite),
  `POST /api/assets/[id]/duplicate`, `DELETE /api/assets/[id]` (Trash). Product mutations keep
  their routes and upsert the index row in the same request. All use `requireUser()`,
  `checkOrigin`, `rateLimit`, owner filters and revision checks.
- Thumbnails: rendered client-side from stored design data (as the prototype does); cached PNG
  thumbnails via `card_studio_media` only if list performance requires it.

No new dependencies are needed: `fflate` (ZIP), `html-to-image`, `qrcode`, `sharp` and
`pdf-lib` already cover every export.

---

## 5. Implementation plan (after approval)

| Stage | Scope | Rough size |
| --- | --- | --- |
| 0 | Hotfix saved-stamp list layout and default naming (can ship alone) | 0.5 day |
| 1 | `design_assets` migration + backfill, asset API, ownership tests | 2–3 days |
| 2 | `/designs` library (search, filters, sort, grid/list, rename, favourite, duplicate, Trash/undo); redirect old dashboard URLs | 3 days |
| 3 | Shared editor shell + Stamp and QR panels moved into it; asset-name vs printed-text split | 4 days |
| 4 | Business card and team contacts in the shell (preserving draft/publish invariants) | 3–4 days |
| 5 | Email signature persistence + editor; print package asset | 3 days |
| 6 | Template tab per product, Create hub "Continue editing" strip | 2 days |
| 7 | QA: workflows, exports, responsive, ownership/integration tests, regression | 2–3 days |

## 6. Risks

- **Index drift**: product tables and `design_assets` must stay in sync. Mitigation: write both
  in one RPC per product, plus a nightly consistency check.
- **Card editor coupling**: `Studio.tsx` has hydration and stale-closure rules; moving it into a
  shell must keep them. Mitigation: wrap, don't rewrite, in stage 4.
- **Thumbnail cost** with many assets: client rendering of 40+ live SVG/HTML previews. Mitigation:
  lazy render on intersection; cached PNG thumbnails if needed.
- **URL changes** break bookmarks. Mitigation: permanent redirects.
- **Legal wording** on stamps/signatures must remain (visual mark, not a verified e-signature).

## 7. Prototype

- Route: `/prototype/studio` (noindex, mock data only, no network writes).
- Prototype edits persist in **this browser only** (localStorage key
  `card-studio-prototype-assets-v1`) to demonstrate refresh survival; *Reset sample data*
  restores the seed.
- Downloads are real: stamp PNG (transparent), QR PNG/SVG, card PNG, signature HTML + copy,
  print package ZIP.

Screenshots from verification: `docs/design-studio-prototype/1-library.jpg` … `8-mobile-qr-editor.jpg`.

Verified on 25 Nov 2026: search by printed stamp text, template → name → editor, live stamp edits,
save survives reload, transparent PNG (1500 px) and print ZIP downloads, Trash confirm + Undo,
list view, phone width (no horizontal scroll, Edit/Preview/Details tabs). Typecheck, lint,
106 unit tests and the production build pass.

Files created for the prototype:

- `app/prototype/studio/page.tsx`
- `components/prototype/data.ts` — asset model, templates, sample library
- `components/prototype/renderers.tsx` — real renderers, preview surfaces, client exports
- `components/prototype/Workspace.tsx` — library, search/filter/sort, rename, new-design, preview, Trash
- `components/prototype/Editor.tsx` — shared three-panel editor and product panels
- `components/prototype/ui.tsx` — shared icon, zoom and preview pieces
- `components/prototype/prototype.css`

Files modified:

- `components/marketing/StampMaker.tsx` — `StampSvg`, its types and `templates` are now
  exported so the prototype renders real stamps. No behaviour change.

## 8. Decisions needed from you

1. Approve the **My designs** consolidation (replacing "My cards" + "My QR codes").
2. Approve the `design_assets` index approach over a single generic table.
3. Ship **stage 0** (saved-stamp hotfix) now, independent of the redesign?
4. Folders: defer (recommended) or include in stage 2?

## 9. Sources

- Canva — [Filter and sort on the homepage](https://www.canva.com/help/filter-sort-homepage/),
  [Find designs and folders](https://www.canva.com/help/find-designs-and-folders),
  [Starring](https://www.canva.com/help/personal-starring/),
  [Rename designs](https://www.canva.com/help/rename-designs/)
- DocuSign community — [How do I create a seal or a stamp](https://community.docusign.com/esignature-171/how-do-i-create-a-seal-or-a-stamp-685),
  [Security and reuse of uploaded stamp images](https://community.docusign.com/docusign-admin-102/security-and-reuse-of-uploaded-stamp-images-in-docusign-stamps-27840),
  [Insert a corporate seal](https://community.docusign.com/notary-98/insert-a-corporate-seal-20340)
- QR Code Generator PRO — [Features](https://www.qr-code-generator.com/features/),
  [Dynamic URL QR codes](https://www.qr-code-generator.com/dynamic-url-qr-code/)
- Blinq — [Creating a Blinq email signature](https://support.blinq.me/en/articles/76200-creating-a-blinq-email-signature),
  [Email signatures overview](https://support.blinq.me/en/articles/68107-blinq-email-signatures-overview)
- HiHello — [Email signatures](https://www.hihello.com:443/features/email-signatures)

Adobe Acrobat Sign, Dropbox Sign, PandaDoc and Popl were reviewed from general product
knowledge only; their specific flows were not re-verified for this document.
