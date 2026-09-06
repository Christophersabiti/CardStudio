# Account experience release — 7 September 2026

Implements the approved pricing/account/card-management plan. Existing account plans and existing card content are preserved. New accounts must complete plan selection; selecting a paid offer does not grant paid entitlements before verified Pesapal fulfillment. Signup intent survives Clerk verification routes in a one-hour HTTP-only cookie. All prices and checkout settings come from the live superadmin catalog.

## User behavior

- Guest export buttons (including public card/group download controls) are disabled. Authenticated exports check the current session again before running. Sign-in links remain available.
- All roles have a 15-minute interaction deadline, with a warning at 14 minutes. Genuine input refreshes a server-held deadline; token refresh and polling do not. The same browser's tabs share activity/logout. Expired deadlines cannot be revived; the Clerk session is revoked. Private UI is hidden while rechecking a signed-in session.
- Private unfinished edits recover from owner-scoped server storage. Recovery does not publish or create a billable card. Guest drafts remain local; importing them after login requires explicit confirmation. Failed recovery is reported and never postpones security expiry. Private plaintext browser draft caches are cleared on logout.
- Free and near-limit users receive Upgrade when an enabled, purchasable destination provides sufficient capacity. Default threshold is 80%, configurable under Administration → Pricing presentation & upgrades. Disabled checkout does not produce dead upgrade buttons.
- Portrait/landscape is saved in card JSON and publication snapshots. Missing legacy orientation remains landscape. The active renderer drives PNG export and scales on small screens without changing orientation. Contact/QR data is unaffected.
- My cards supports per-user list/thumbnail preference, keyword search across the complete owned collection, separate Trash filtering and combined 24-result pagination. Search covers contact text, normalizes common Latin accents and phone punctuation, and excludes image data. Owner filters precede search and pagination. Trigram and owner/date indexes are installed.

## Verification

50 tests pass, including server idle deadline boundaries and no revival, browser-role restrictions, owner-isolated cross-page search, phone/accent search, Trash, new-user onboarding defaults, orientation validation and upgrade eligibility. Existing quota, trial, publication and payment idempotency tests remain passing. Lint and production build pass.

Browser checks confirmed valid guest details still leave all four exports disabled, portrait survives draft reload, and pricing renders the current enabled offers with plan-specific signup links. Production SQL search returns the existing owner's six cards. The migration preserved the complete card-content fingerprint and marks existing accounts onboarded.

No live paid transaction was initiated. Authenticated end-to-end visual acceptance and an actual export download require a signed-in browser session; database/auth boundary tests do not substitute for those visual checks.

## Operations

Migration: account_experience, additive tables/columns/functions/indexes. Supabase migration history has older pre-existing gaps documented in commercial-release.md; do not blindly replay older foundations. No new environment secrets are required. All new tables are service-only with RLS and no browser grants. The advisor's “RLS enabled, no policy” informational notices are intentional default-deny for these tables: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy . Legacy Supabase Auth's password-protection notice is unchanged; application login is Clerk.

Recovery keys are limited to the user's real card/group slugs or one new draft per kind. Session records are retained as tombstones so old expired sessions cannot be reinitialized. Any later cleanup must respect the provider's maximum session lifetime. Native Clerk inactivity configuration remains optional defense in depth because its token-refresh definition differs from human interaction; no paid Clerk plan change was made.

Rollback may restore the previous app deployment while retaining additive schema, current card data, payment history and access controls. Do not drop orientation from saved JSON or remove session checks to bypass an error.
