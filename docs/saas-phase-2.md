# SaaS Phase 2 — Clerk authentication

## Status and scope

Implemented locally. User approved finishing code/build while leaving hosted changes pending. No hosted migrations or DNS changes were performed. The user subsequently authorized committing and pushing Phases 1 and 2 and elected to perform acceptance testing in production. Phase 3 has not started. This runbook supersedes the older Supabase email-auth setup for this checkout.

Clerk handles signup, login, recovery, profile and logout. Application routes independently verify Clerk identity, live session/account status and verified primary email. An atomic server-only RPC creates the internal user UUID, profile and Free subscription. Existing owner UUIDs and public slugs are preserved by the migration. Admin roles come from the database, never Clerk profile metadata. Native Supabase third-party authentication maps the Clerk JWT subject to the internal owner UUID for RLS reads; writes remain server-only.

Clerk lifecycle webhooks verify signatures over bounded raw request bytes, deduplicate deliveries and reject stale updates. Deleted identities remain tombstones; content and financial records are retained. Persistent bans synchronize to the database; temporary locks are checked live in application requests. Database reads with already-issued tokens remain subject to JWT expiry and webhook delivery; live application session checks do not revoke a JWT directly at Supabase. Clerk outages fail closed and live verification adds request latency.

Legacy password/link endpoints are retired. Existing Supabase login cookies do not grant access. Plan selection, usage UI and paid billing remain later phases.

## Local verification results

- 37 automated tests: schema migrations, real SQL owner isolation, provisioning, identity linking, webhook ordering/deletion and real SDK signature verification, plus existing application tests.
- TypeScript, ESLint and production build pass.
- Local HTTP smoke: sign-in/signup return 200, dashboard redirects anonymous visitors, account API returns 401, retired password endpoint returns 410, old callback discards its token and redirects.
- Full Clerk login/dashboard and the opt-in integration suite are **pending** external setup. The previous 38-check Supabase-auth run is not evidence for Phase 2.
- Current backend Clerk credential was accepted, but browser Clerk JS failed to load from `clerk.cardstudio.sabtechonline.com`. Use development keys locally. A successful build does not verify Clerk frontend domain configuration.
- Current configured database lacks both SaaS migrations; webhook signing secret is missing.

## Manual setup, in order

1. **Clerk:** select a development instance for local testing. Enable email/password signup, email verification and password recovery. Copy a matching `pk_test_…` / `sk_test_…` pair to `.env.local` as `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`. Keep secrets out of commits and messages. Do not use production accounts for automated tests.
2. **Database — deferred until separately approved:** prefer a dedicated staging Supabase project. Apply all migrations in filename order to a fresh database. For the existing project, follow [Phase 1 preflight/history guidance](saas-phase-1.md), backup and verify baseline history before applying only the two pending migrations: `20260906085317_saas_foundations.sql`, then `20260906105429_clerk_identity_cutover.sql`. Do not blindly replay baselines. The Clerk RLS cutover is incompatible with the original hosted authentication, so coordinate it with application deployment; do not apply it to the live original app merely to test locally.
3. **Clerk + Supabase:** enable Clerk's Supabase integration and configure Clerk as a third-party auth provider in the chosen Supabase project using the matching instance domain. Use the native integration; this code passes the normal Clerk session token, not a legacy named JWT template. Confirm a signed-in user's token can perform owner-scoped reads. Set matching `NEXT_PUBLIC_SUPABASE_URL`, public publishable key (or existing anon key) and server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. **Clerk webhooks:** expose the local webhook endpoint through an HTTPS tunnel, register `<tunnel-origin>/api/webhooks/clerk`, subscribe to `user.created`, `user.updated`, `user.deleted`, and save its signing secret as `CLERK_WEBHOOK_SIGNING_SECRET`. The production endpoint will be `https://cardstudio.sabtechonline.com/api/webhooks/clerk`; it requires its own endpoint secret. Test delivery and retries from Clerk. A tunnel is only for incoming webhooks; browse the app at localhost.
5. **Local environment:** set `NEXT_PUBLIC_SITE_URL=http://localhost:3000`. Use that exact browser origin. Start the server bound to localhost; binding to 127.0.0.1 while browsing localhost caused middleware proxy failures in this session.
6. **Legacy owners:** independently verify control of both accounts and link them before their first CardStudio Clerk provisioning. An administrator can run `npm run account:link -- SUPABASE_USER_UUID CLERK_USER_ID --ownership-verified`. This changes the selected database and is deferred with hosted changes. The script refuses automatic merges; do not claim accounts by email or public slug. Existing accounts already provisioned need a separately reviewed reconciliation.
7. **Vercel/DNS — later phase:** use production Clerk keys only after Clerk production domain/DNS verification. Configure the production app origin and production database/provider/webhook together. Rebuild after changing any `NEXT_PUBLIC_*` value. Never deploy this checkout against the old schema.

## Commands

Use Node 22 or newer. After saving configuration:

```sh
npm ci
npm run check:auth
npm run typecheck
npm run lint
npm test
npm run build
npm run start:local
```

Stop any existing server on port 3000 first. `check:auth` is read-only and exits nonzero for missing setup. For active development, use `npm run dev` instead of the build/start pair. Restart after environment changes; rebuild before testing a production server with changed public keys.

Once the dedicated test services and migrations are ready, keep the server running and use a second terminal:

```sh
CARD_STUDIO_TEST_ORIGIN=http://localhost:3000 npm run test:integration
```

This opt-in suite creates synthetic Clerk development users/sessions and card/group/media fixtures. It cleans up test content and Clerk identities; internal deleted-account tombstones and subscription history are intentionally retained to tolerate delayed webhooks. It is not read-only. Do not run against production. The old password integration script is retired.

## Manual acceptance checklist

- In a private browser window, visit `/dashboard`, `/edit/cards/<known-slug>` and `/dashboard/account`: require login. Anonymous private API calls must fail.
- Sign up with a new verified email; reach dashboard. Refresh/re-login: exactly one internal user, profile and Free subscription.
- Log out, confirm private access fails, then log in again. Verify password recovery email and changed-password login. Test any configured social login separately.
- Open Account, edit profile, test verification/recovery settings. Confirm no browser metadata can grant admin access.
- With two distinct accounts in separate browser profiles, create private content under A. B must not list/read/edit/delete A's cards, groups or media, including direct URLs/API requests. Verify B cannot read A's subscription/billing rows through Supabase. Public published snapshots remain intentionally accessible.
- Save, publish and share a card; logged-out viewing shows only the published snapshot. Unpublish and confirm access is removed. Exercise image upload, duplication, Trash and restore.
- Link a verified legacy test owner before provisioning; verify original cards and URLs are preserved. Unlinked/anonymous legacy records must not become claimable.
- Deliver duplicate/out-of-order webhooks; verify no duplicate account or subscription. Ban/delete a test identity and revoke a session; application access must fail while existing content remains. Confirm a temporary lock does not permanently disable the account after it expires.
- Check sign-in, signup, recovery and profile screens at mobile width. Inspect browser/server errors; a blank Clerk form is a failed acceptance test even when HTTP is 200.

## Approval gate

Code/build verification is complete locally. Hosted configuration and full authentication acceptance remain pending by request. Complete the external setup and manual checks above before marking Phase 2 accepted for deployment. Phase 3 begins only after the user's approval; commit/push has subsequently been explicitly authorized by the user. Production acceptance still requires the coordinated database, Clerk domain, native integration and webhook setup above.
