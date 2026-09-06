# Card Studio

Commercialization Phases 1 and 2 are implemented and tested locally; hosted
migrations and full Clerk acceptance remain pending. Start with the
[SaaS Phase 2 runbook](docs/saas-phase-2.md) for current setup, local commands,
manual checks and approval gates, and the [Phase 1 runbook](docs/saas-phase-1.md)
for database preparation. Older phase labels below describe the original app.

A branded digital business-card and group-contact builder built with Next.js 16,
React 19, TypeScript, Tailwind, and Supabase.

## Features

- Live card previews, local draft recovery, offline vCard QR codes and named QR/PNG exports.
- Clerk sign-up, sign-in, recovery, profiles and an owner-scoped My Cards dashboard.
- Private cloud drafts, publication snapshots, stable editable profile links, duplication, unpublishing, and recoverable Trash.
- CSV group contact bundles, with explicit permission confirmation before public sharing.
- Dynamic profile QRs after publishing; separately labeled offline contact snapshots.
- Validated raster images in private storage, served through an ownership/publication check.
- Strict request validation, byte limits, same-origin writes, durable rate limits and safe error responses.
- Neutral, PMI Uganda and Sabtech brand presets.

Phase 2 mobile redesign/templates and Phase 3 organization administration are not included.

## Local setup

Use Node 22 or newer. Install dependencies with `npm ci`.

Copy `env.example` to `.env.local` and provide:

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public API key used for Clerk-token owner-scoped reads |
| `SUPABASE_SERVICE_ROLE_KEY` | Server secret/service-role key; never expose in browser code or commit |
| `NEXT_PUBLIC_SITE_URL` | Canonical app origin, e.g. `http://localhost:3000` |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk development publishable key locally |
| `CLERK_SECRET_KEY` | Matching server-only Clerk secret |
| `CLERK_WEBHOOK_SIGNING_SECRET` | Clerk webhook endpoint signing secret |
| `NEXT_PUBLIC_BRAND` | `neutral`, `pmi`, or `sabtech` |

Start with `npm run dev`, then open the exact origin configured above.
Placeholder keys do not work. The app intentionally fails closed if the server
key or rate-limit database is unavailable.

## Database setup

For a new database, apply files in `supabase/migrations` in filename order:

1. `0001_init.sql`
2. `0002_groups.sql`
3. `20260905165303_ownership_and_publishing.sql`
4. `20260905170804_restrict_internal_functions.sql`

The two timestamped migrations have already been applied to project
`jnwkmzirnrqutryntley`; do not rerun them there. Their local filenames match the
remote migration-history versions. The original two baseline files were applied
manually before migration tracking. If adopting `supabase db push` for this
existing project, reconcile those baseline history entries through the CLI's
migration-repair workflow after verifying the existing schema; do not replay all
historical migrations over the running application.

The ownership migration preserves existing anonymous links by copying their
content into `published_data`. New records default to private. Anonymous legacy
records are never claimable solely by knowing their public URL.

## Authentication

Use Clerk with native Supabase third-party authentication. Complete the
[Phase 2 manual setup](docs/saas-phase-2.md) before testing authenticated saves.
Both SaaS migrations are required after the four baseline migrations listed above.
The old Supabase password and email-link endpoints are retired.

## Privacy and authorization

Browser clients have SELECT permission only on cards/groups/media, with owner
RLS. All mutations pass through server endpoints, which validate the session,
filter by the verified `owner_id`, validate the payload and apply a shared database
rate limit. The privileged client is server-only. Public page readers select only
published snapshots from non-deleted records; there is no anonymous table read.

Images live in `card-studio-private`. The `/api/media/[id]` endpoint checks whether
the requester owns the image or it is referenced by a currently published card.
Responses are not publicly cached. Unpublishing stops subsequent hosted access,
but cannot recall downloaded images, QR screenshots or contact files.

`Save private draft` never overwrites the published snapshot. `Publish updates`
replaces the snapshot at the existing slug. `Move to Trash` unpublishes and retains
the record; `Restore as draft` does not republish it. Cloud edits use a revision
check so an older tab cannot silently overwrite a newer edit.

Rate limits: 30 record mutations/minute and 15 direct uploads/minute per account.
Clerk handles authentication flow protections. Database limits remain server-only.

## Verification

```sh
npm run typecheck
npm run lint
npm test
npm run build
```

The opt-in integration suite requires a valid server key and the migrated test
project. Start the production build locally, then in another terminal:

```sh
CARD_STUDIO_TEST_ORIGIN=http://localhost:3000 npm run test:integration
```

It creates synthetic accounts without sending email and removes only their test
records, images and Clerk accounts in a `finally` block. Internal deleted-account
tombstones and subscription history remain. It requires development Clerk keys. It checks owner isolation,
private/public snapshots, validation, media revocation, duplication, Trash,
conflicts, group consent, Clerk session revocation, and concurrent rate limiting.
Do not point it at an unrelated project. Physical iPhone/Android camera and
Contacts-app tests remain a separate release check; a `.vcf` download is not proof
that every contact was imported.

## Operations

See `docs/phase-0-1-operations.md` for migration recovery, legacy ownership,
retention, deployment prerequisites and current verification status.
