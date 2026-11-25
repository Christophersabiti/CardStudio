# My designs library — release notes

Implements the approved proposal in `docs/design-studio-redesign-proposal.md`
(decisions taken: one "My designs" page, the `design_assets` index, the stamp
hotfix first, folders deferred).

## What changed

- **`/designs`**: one owner-scoped library for business cards, team contacts, QR
  codes, e-stamps, email signatures and print packages. Search covers private names, people,
  companies and text printed on stamps. It also has product filters with counts, All/Favourites/
  Recent/Trash, sorting, grid/list, inline rename, favourites, duplicate, Trash with
  Undo, restore, unpublish, open public page, preview and downloads.
- **Email signatures are saved** (`signature_designs`, `/api/signatures`). Signed-out
  visitors keep a browser draft; saving needs an account. `?design=<id>` reopens one.
- **Print packages are saved designs** (`print_packages`, `/designs/print/[id]`). A
  package links a saved card, QR code and stamp; one ZIP download keeps each part's
  existing rules (print plan and matching publication for the card, published QR
  with plan features, monthly stamp quota counted only after every part renders).
- **Stamp maker**: saved list fixed (layout, thumbnails, dates, current design),
  duplicate no longer corrupts the copy, a template no longer overwrites a typed
  name, names are unique per account, `?design=<id>` opens a saved stamp.
- **Navigation**: "My designs" replaces "My cards" and "My QR codes". The dashboard
  shows recent designs; old `/dashboard?q=…`/`?trash=1` links redirect to `/designs`.
  `/dashboard/qr` stays as "QR codes and scans" for statistics and archived codes.
- Shared server helpers: `lib/qr-studio/export.ts` and `lib/print-package/card.ts`
  are now used by both the existing export routes and print packages.

## Deploy

1. Apply `supabase/migrations/20261125123933_design_assets_library.sql` through the
   normal migration runner (it creates three service-role-only tables and
   `list_design_assets`; no existing table or data changes).
2. Deploy the app. Without step 1, `/designs`, the dashboard strip and saving
   signatures or print packages return errors.
3. Smoke test signed in: create and save a stamp, find it in My designs by its
   printed text, rename it, star it, duplicate it, move it to Trash and undo; save
   a signature and reload; save a print package and download it.

## Verified locally (25 Nov 2026)

- PGlite schema tests (`tests/design-assets.test.ts`): owner isolation, derived and
  private names, search, Trash/Recent/sort, publish-match flag, revision bump, browser
  roles denied.
- Typecheck, lint, 112 unit tests, production build.
- Browser: signed-out redirects and 401s for every new API; stamp template naming;
  signature draft survives reload; library rendering, preview, card PNG export,
  rollback on a failed action, phone width (no horizontal scroll).

## Not verified

Signed-in flows against a real database: local development points at the hosted
project with production Clerk keys, and the migration has not been applied there.
Run the smoke test above, or `npm run test:integration` against a project with the
migration, before announcing the release.
