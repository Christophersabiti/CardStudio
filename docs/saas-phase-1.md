# Commercialization Phase 1 — database foundations

This is the new SaaS roadmap's Phase 1, separate from the older UI/auth phases
described in `phase-0-1-operations.md`.

## Status

Implemented and verified locally. The hosted database migration and its baseline
history repair are pending target selection and recoverable-backup confirmation.
No hosted schema/history, Clerk, Pesapal, DNS, or Vercel deployment settings have
been changed in this phase. Do not begin Phase 2 before the user's phase approval.

## What changed

- CLI-generated `20260906085317_saas_foundations.sql` adds 13 tables: users,
  profiles, plans, plan_prices, subscriptions, group_cards, qr_codes,
  billing_orders, payments, subscription_events, payment_events, usage_counters,
  usage_events.
- Internal user IDs preserve real legacy account UUIDs. Supabase identity is a
  nullable mapping and Clerk identity is a unique, initially unset mapping. No
  automatic linking by email, no anonymous record claiming, no role copying.
- Existing users receive an empty profile and Free subscription. Anonymous auth
  users are excluded. Auth users created AFTER this migration are deliberately
  not auto-provisioned yet: Phase 2 must idempotently provision on verified login
  and perform a final legacy catch-up before switching ownership constraints.
- Existing cards/groups/media keep their current `auth.users` foreign keys and
  owner SELECT policies. Their owner IDs, slugs, content, published snapshots,
  media paths, Trash, revisions, and views stay intact.
- Cards and groups gain `archived_at` (default NULL). Archiving must unpublish;
  no archive UI is enabled now. Existing groups default to `contact_bundle`;
  `collection` distinguishes future card folders. Same-owner composite FKs
  prevent cross-account card/group membership.
- Media gains nullable measured bytes and MIME type plus image/document kind.
  Unknown size is NULL, not zero. Existing private bucket limits are unchanged;
  document upload support is not enabled.
- All new tables have RLS enabled, all browser/PUBLIC grants revoked, and explicit
  server grants. Clerk-compatible owner reads arrive together with identity
  verification in Phase 2. Existing application access is unchanged.
- Prices/orders and payment financial identity are immutable; subscription and
  usage events are append-only. Corrections require new records/events. The inbox
  remains mutable for retries. No activation or payment API is implemented here.
- `lib/saas/types.ts` defines contracts without importing future logic into the UI.
- Pinned dev-only PGlite executes the real migrations in local in-memory Postgres.

## Seeded commercial proposals

| Plan | Active cards | Standalone QR | Groups | New cards/month | New QR/month | Storage | Monthly UGX | Annual UGX |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Free | 1 | 3 | 1 | 5 | 10 | 5 MB | 0 | 0 |
| Basic | 5 | 20 | 5 | 25 | 100 | 50 MB | 20,000 | 200,000 |
| Premium | 25 | 100 | 20 | 100 | 500 | 250 MB | 60,000 | 600,000 |

MB means decimal bytes. Money is integer minor units with an explicit currency
exponent (UGX: 0). Paid plans and all paid prices are DISABLED. No checkout can
be enabled by this migration; pricing UI and enforcement belong to Phases 5–7.
Only enable paid features when delivered and approved. Do not sell promised
team collaboration or advanced analytics from these seeds.

`plans` versions contain typed quotas plus feature JSON. New commercial terms
require a new version and new prices; toggling enabled is permitted. The plan
snapshot in a billing order remains fixed even after a new catalog version.

## Relationships and transition boundary

`users` owns profiles (1:1), subscriptions (one current row per user), QR codes,
group memberships, billing orders, payments and usage. Subscriptions reference a
plan and an optional matching plan price. Orders reference the subscription and
the intended purchase price; they snapshot the amount/currency/interval. Payments
reference an order with the same owner. Events reference the same-owner
subscription/order. Provider tracking and merchant references are unique per
provider. Unknown notifications live in the server-only inbox until verified.

Cards/groups/media still reference Supabase Auth in this phase, deliberately.
Before Phase 2 drops those old FKs, backfill missing internal identities, verify
all existing non-null owners map, add/validate internal-owner FKs, replace SELECT
policies and the session adapter, and test old-user linking and all mutations.
Do not turn on Clerk by swapping the cookie library alone.

Counters are not initialized to zero: Phase 5 must reconcile them from real
resources at the quota-service cutover. Active/storage metrics use `current`;
monthly metrics use UTC `YYYY-MM`. Restore/duplicate/import semantics and atomic
count/create enforcement are not implemented by these tables alone. Monthly
creation events cannot be refunded by deleting a resource.

Detailed daily analytics is deferred until the analytics increment; existing
view counts remain available. Hosted document storage and detailed asset
references belong to Phase 4. No unused analytics table is introduced now.

## Local verification

Verified on 6 September 2026:

| Check | Result |
| --- | --- |
| TypeScript | Passed |
| ESLint | Passed |
| Unit + local Postgres schema tests | 24 passed |
| Next.js production build | Passed; 14 static pages generated |
| Local production HTTP smoke | Home/login 200; unauthenticated dashboard 307; missing card 404 |
| Existing HTTP/Supabase integration suite | 38 passed; synthetic fixtures cleaned |
| Patch whitespace check | Passed |

The first integration attempt used 127.0.0.1 and was rejected by the configured
localhost origin check. No application change was needed; rerunning at the
canonical localhost origin passed all 38 checks. Next.js also reports a harmless
ignored package-lock outside this repository; the repository lockfile is used.
The local server is available at http://localhost:3000 while its process remains
running. The 38 integration checks use the current hosted schema, not the
unapplied SaaS migration. The 12 new schema checks run the new migration locally.

Run from the repository root:

```sh
npm ci
npm run typecheck
npm run lint
npm test
npm run build
npm run start -- --hostname 127.0.0.1 --port 3000
```

The schema tests use no secrets or network. They apply ALL historical migrations
unchanged, using pgcrypto and small fixtures for Supabase-owned auth/storage
schemas and roles. They verify a fresh install and migration over existing
private/published/unowned content, preserving old auth/RLS; all new client grants
denied; same-owner constraints; seeded prices disabled; immutable purchase terms;
payment identifiers; QR publication validity; usage periods and idempotency;
append-only history and duplicate notifications.

PGlite is a Postgres engine, not a string-matching schema test. It does not replace
managed Supabase API/storage/auth integration, multi-connection concurrency tests,
or staging acceptance. Those remain explicit rollout gates.

The existing integration suite uses the LOCAL production server but the configured
Supabase project. It creates and removes synthetic accounts and media, sends no
email, and checks the unchanged application flow:

```sh
CARD_STUDIO_TEST_ORIGIN=http://localhost:3000 npm run test:integration
```

Use the exact `NEXT_PUBLIC_SITE_URL` origin for login and mutation tests. The
`127.0.0.1` alias may serve GET pages but is not interchangeable with `localhost`
for the application's origin checks and cookies.

## Hosted migration runbook — pending approval gate

1. Confirm the target (existing CardStudio project `jnwkmzirnrqutryntley` or an
   explicitly selected staging project) and a recent recoverable backup. Database
   backups do not substitute for an object-storage recovery plan. Do not create
   a paid staging project without the user's choice and cost authorization.
2. Verify CLI login/project targeting without printing tokens. CLI 2.116.0 was
   used to generate this migration; inspect `--help` on version changes.
3. Run `supabase/checks/saas-preflight.sql`, retain output privately and review
   schema/grants against the four existing migration files. Inspect more column
   details if there is drift; existence alone does not prove baseline equivalence.
4. On the EXISTING audited project only, the two timestamped migrations are
   recorded, but 0001/0002 were applied manually. After review, repair HISTORY
   ONLY; never rerun the old ownership migration over private drafts:

```sh
npx supabase@2.116.0 migration repair 0001 0002 --status applied --project-ref jnwkmzirnrqutryntley
npx supabase@2.116.0 migration list --project-ref jnwkmzirnrqutryntley
npx supabase@2.116.0 db push --project-ref jnwkmzirnrqutryntley --dry-run --skip-vault
```

5. Dry run must propose ONLY `20260906085317_saas_foundations.sql`. Stop on any
   old migration replay, unexpected target, or drift. A fresh staging project
   instead applies all migrations in order and needs no fake baseline repair.
6. Apply using the migration runner after the gate is satisfied:

```sh
npx supabase@2.116.0 db push --project-ref jnwkmzirnrqutryntley --skip-vault
```

7. Rerun the read-only preflight. Resource counts/fingerprints must match unless
   separately explained by legitimate writes during the window. Verify the new
   13 tables, RLS/grants, two disabled paid plans, four disabled prices, Free
   subscriptions and mapping completeness. Check migration history and Supabase
   security/performance advisors. Repeat the local production build's integration
   suite against the migrated target; no Clerk or billing UI should appear yet.
8. Record results, complete the user's manual checks below, and seek Phase 2
   approval. Remote history repair/application has NOT been executed merely
   because the local files exist.

## Recovery

Apply the migration transactionally: if any statement fails, roll back the whole
transaction and investigate before retrying. Do not run individual fragments or
rename an already-applied version. Local tests run migrations in transactions.

Since current application code does not depend on the new tables, an application
rollback can leave the additive schema intact. After success, prefer a corrective
forward migration; do not drop new tables after accounts or billing data exist.
Use a tested backup restore only with an explicit target/window and awareness of
post-backup writes. Baseline history repair is metadata, not data restoration.

## Manual checks and approvals after this phase

- Open the local build; sign in through the current Supabase login.
- Confirm your existing card is listed. Edit a test card, save a draft, publish,
  open the share link in a private window, download/scan the QR, then unpublish.
- Confirm private changes do not appear publicly; sign-out blocks the dashboard.
- Confirm no Clerk login, paid checkout or plan-limit restrictions appear yet.
- Approve or revise the proposed quota/price seeds before future paid activation.
- Confirm hosted database target and recoverable backup before remote migration.
- After hosted verification, explicitly approve Phase 2 (Clerk). Prepare Clerk
  development application keys and the Supabase third-party integration then;
  no Clerk/Pesapal/Vercel/DNS setup is required for this local Phase 1 build.

At EVERY later phase: run typecheck, lint, automated tests, a local production
build and relevant local smoke/integration checks; report evidence, give the
phase's manual checklist, identify external setup, then wait for approval of the
next phase. Never treat a passing build as permission to deploy or skip the gate.

## Audit note

The unchanged hosted project's current security advisor reports leaked-password
protection disabled in Supabase Auth. This predates the SaaS schema; review/enable
it while Supabase passwords remain in use, or retire that login during the Clerk
cutover. This is not a clean post-migration advisor result (migration is pending).
See https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection.

## Subsequent approval

The user approved Phase 2 local code/build work while explicitly leaving hosted
changes pending. See [Phase 2](saas-phase-2.md) for current status and the coordinated
authentication cutover; this does not authorize applying hosted migrations.
