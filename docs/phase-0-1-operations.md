# Phase 0–1 implementation and operations

Status: deployed on 5 September 2026 to https://cardstudio-delta.vercel.app.
Connected database migrations are applied and production secrets are configured.
GitHub push awaits restored credentials. Public email onboarding is blocked until
Supabase URL configuration is corrected: a generated link still falls back to localhost.

## Current verification

- Production build passed on Next.js 16.3.4 / React 19.2.8.
- Type checking and lint passed.
- Ten foundation tests passed, covering nested validation, safe URLs, local redirect boundaries,
  snapshot equality, Unicode vCard folding, QR decoding and actual-byte limits.
- Dependency audit returned zero vulnerabilities after dependency updates.
- Supabase security advisor returned zero findings after both migrations.
- Performance advisor reported only unused-index informational notices on the
  empty/new tables. Retained indexes required for ownership and media lookups;
  reassess against real traffic before removing them. [Advisor guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index)
- Database grants verified: authenticated owner SELECT allowed; direct INSERT,
  UPDATE, anonymous table SELECT, public counter execution and client rate-limit
  overrides denied.
- Browser: blank draft, accessible field labels, editing, offline QR generation,
  named QR export and digital-card export exercised. Both downloaded PNGs were
  decoded and contained the expected synthetic contact.
- All 38 live integration checks passed against the configured localhost origin.
  This includes two-account isolation, publishing, draft snapshots, image access
  and revocation, duplicate/Trash/restore, group consent, conflict handling,
  atomic rate limiting and sign-out. Synthetic accounts and fixtures were removed.
- An attempted transactional SQL fixture test was rejected by the connector's
  read-only SQL mode; it made no persistent changes. Do not treat owner-isolation
  behavior as verified by that SQL attempt; the later HTTP integration suite
  independently verified owner isolation.
- Production smoke checks passed: home/login return 200, dashboard redirects to
  login, missing profiles return 404, and a synthetic email-token confirmation
  creates a session and redirects to the production dashboard. The test user was removed.
- Physical phone scanning/import and real email delivery remain outstanding. Existing mobile layout redesign is intentionally Phase 2.

## Required before release

1. Production server key is stored as a Vercel Secret; public Supabase settings
   and the canonical production origin are configured.
2. Set the canonical site origin and Supabase callback allowlist. Validate an
   email link from an actual mailbox. Production SMTP is an operational prerequisite
   for unrestricted public onboarding; inspect the project's current settings.
3. Run `npm run build`, start the app, then run the integration suite as described
   in README. The local run passed all 38 checks; it performs real HTTP and
   database checks, not mocks.
4. Verify published/updated/unpublished QRs and `.vcf` files on a real iPhone and
   Android device. Test group import at small and representative roster sizes.
5. Production deployment is ready: `dpl_8HjwNrJwBR8XNpP3bAgTRx8Ny1QE`.
   It was built from the committed source only; local secrets and unrelated
   deliverables were excluded from the upload.

## Authorization boundary

`lib/records.ts` verifies the session with `getUser`, rejects anonymous Auth users,
checks origin, applies account rate limits, validates the request, and filters
privileged reads/writes by both slug/ID and verified owner. User-supplied owner
IDs are not accepted. Dashboard reads use a session client and RLS. Public readers
never select the private `data` draft for display.

The database intentionally revokes browser writes. Granting authenticated clients
INSERT/UPDATE/DELETE would create a path around the API's validation/rate limiting
and must not be done without moving those invariants into the database first.

The rate RPC and view counters are executable only by the server role. The
infrastructure RLS event trigger's incidental public execution grants were also
removed; its event-trigger behavior remains in place.

## Anonymous legacy card ownership

No automatic claim endpoint exists. Verify identity independently before assigning
an old card/group to an account. A public slug, knowledge of the visible fields,
or a user-editable email field is not proof of ownership. An administrator may
assign `owner_id` only after verification and should record that verification in
their operational audit. Existing public URLs and snapshots remain unchanged.

The connected cards/groups tables contained zero rows when migration began, so
no legacy rows required backfill there.

## Migration and rollback

Applied remote versions and corresponding local files:

- `20260905165303_ownership_and_publishing.sql`
- `20260905170804_restrict_internal_functions.sql`

The migrations add ownership, published snapshots, soft deletion, revisions,
private image metadata/storage, and rate limits. Original card data is retained.
Take a database backup before future schema work. A full rollback to the anonymous
MVP application is unsafe: its privileged readers ignore publication/deletion
flags and would expose private drafts. If a release fails, disable writes and
retain the new public-read filters (or serve maintenance pages) while repairing
it. Do not drop ownership/published columns or blindly deploy the old code.

## Retention and cleanup

Trash currently has no automatic expiry; the dashboard can restore it as a private
draft. Avoid promising automatic erasure. Replaced or unused media is retained so
in-flight saves, duplicated cards, stored drafts and Trash remain recoverable.
Before adding media garbage collection, check references in both `data` and
`published_data` across all cards, include deleted cards, use a grace period and
coordinate with active uploads. Do not delete objects solely because they are
absent from a published snapshot.

Rate-limit buckets expire automatically; stale buckets older than a day are
removed on subsequent limiter calls. No raw email/IP values are stored there.
Image metadata includes owner and upload time. Uploaded images are decoded,
resized and re-encoded without preserving source metadata.

## Limitations and intentionally deferred work

- Local drafts are browser storage, scoped by account; they are not encrypted or
  a substitute for signing out/using a trusted device.
- The existing CSV parser and fixed preview design remain; mapping, deduplication,
  editable import rows and complete mobile redesign belong to later phases.
- View counts represent render requests, not unique scans or confirmed imports.
- No enterprise roles, CRM integration, wallet passes, billing or Google OAuth.
- ESLint 9 is pinned because the current Next.js React lint plugin failed with
  ESLint 10. The dependency audit is clean, but revisit the toolchain when the
  upstream plugin supports ESLint 10.
