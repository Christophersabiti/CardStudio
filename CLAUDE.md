# Card Studio — repository guidance

## Current application

Next.js 16 App Router, React 19, TypeScript, Tailwind, Clerk authentication, Supabase Postgres/
private Storage. Commercialization Phases 1 and 2 are implemented locally; hosted cutover remains pending. Read `README.md` and
`docs/saas-phase-2.md` for current setup, current verification and deployment gaps.

The server key was validated on 5 September 2026 and all 38 legacy-auth integration
checks passed then. That is not verification of the Clerk cutover. Never print keys or substitute a public key for the server
credential. Revalidate environment configuration when changing deployment targets.

## Before committing

Run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run build`.
The opt-in `npm run test:integration` requires the local app and a real server key;
it creates and removes synthetic test accounts, without sending email.

## Authorization and publication invariants

- `lib/auth/session.ts` verifies Clerk identity, live session/account status and
  the internal UUID mapping. Every private handler independently checks identity.
  `lib/supabase/session.ts` passes Clerk JWTs to owner-scoped database reads.
  Never derive ownership or admin roles from client-supplied metadata.
- `lib/supabase/server.ts` is privileged and `server-only`. Every mutation must
  filter by the verified `owner_id`, not a client-provided ID or email. Never
  import the admin client into client components.
- Browser database clients have owner-scoped SELECT only. INSERT/UPDATE/DELETE
  are revoked so they cannot bypass validation, origin checks and rate limiting.
- `data` is a private draft. Public pages must read only `published_data` where
  `published=true` and `deleted_at IS NULL`. Do not use `data` on public pages.
- Save draft leaves the published snapshot unchanged. Publish updates replaces
  the snapshot at the same slug. Mutations compare `revision` to prevent lost
  updates. Creation/duplication IDs make retry requests idempotent.
- Deletion is recoverable Trash and must unpublish. Restore stays private.
- Group publishing requires an explicit confirmation of authorization to share
  all member details. Do not infer consent from an earlier draft save.
- Legacy anonymous cards have no self-service claim route. Public slugs and
  visible contact details do not prove ownership.
- The database rate limiter is shared across serverless instances, atomically
  updated and callable only by the service role. Fail closed when unavailable.
- Keep arbitrary forwarding headers out of authentication/rate-limit decisions.
  Vercel's overwritten header is explicitly trusted; other hosts require their
  own verified proxy configuration.

## Data and UI

- `lib/types.ts`: CardData, GroupData and their saved-record lifecycle fields.
- `lib/validation.ts`: strict cloud schemas and bounded local recovery schemas.
  Keep fields aligned with forms, vCards and types. URL protocols are allowlisted.
- `components/Studio.tsx`: guest/account-scoped local drafts and editing. Restore
  browser data only after hydration, and never overwrite an existing draft with
  initial server defaults. Async image/file updates must merge into current form
  state, not a stale closure.
- `components/CardPreview.tsx` stays presentational and shared by builder/public
  pages. Dynamic QR labeling differs from offline QR labeling.
- Single-card offline QR encodes a vCard snapshot. Dynamic QR encodes the published
  profile URL. Group QR encodes the published group URL. Never display/export a
  previous QR alongside unsaved or unpublished changes as though they match.
- Keep named QR PNG export (`lib/downloadQrCard.ts`) and its quiet zone intact.
  Full-card PNG capture uses `html-to-image` through `lib/captureCard.ts`.
- Group CSV importing remains a lightweight bundle flow. Organization workspaces,
  row editing/mapping and team provisioning belong to later phases.

## Image storage

`lib/media.ts` validates, decodes, resizes and re-encodes raster uploads. Images
live in a private bucket. `/api/media/[id]` checks ownership or a published card
reference on every request and does not publicly cache its response. Do not turn
this into a public bucket or persist signed URLs in card data: doing so weakens
revocation. Retain media referenced by drafts, published snapshots and Trash.

## Configuration and migrations

Brand presets in `lib/brand.ts` feed CSS variables from the root layout. Preserve
neutral, PMI Uganda and Sabtech presets. The canonical site origin must match the
origin used for Clerk login and authorized parties.

Async Next.js route params and `cookies()` must be awaited. `next lint` has been
replaced with ESLint's CLI; configuration is `eslint.config.mjs`. ESLint 9 remains
pinned for compatibility with the upstream Next.js React lint plugin.

Use the Supabase CLI to create migration files. Keep local migration versions
aligned with the applied remote versions. The original `0001`/`0002` schemas were
applied manually before history tracking; reconcile their baseline history before
using CLI push against that existing project. Never replay old privileged public
read behavior over data containing private drafts.

The webpack symlink workaround remains for Parallels/shared-folder compatibility.
Scripts explicitly use webpack. If a shared-filesystem build fails with EISDIR,
verify on a native filesystem; do not redesign the app around that environment.
