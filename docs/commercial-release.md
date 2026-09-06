# Commercial release — 6 September 2026

## Operating the release

Home: https://cardstudio.sabtechonline.com
Superadmin: `/admin`; customer billing: `/billing`; builder: `/studio`.

Only an active database superadmin can change catalog versions, quotas, checkout settings, trial settings, roles, or account status. The requested verified Clerk identity was promoted operationally; no email allowlist or password is committed. Resource moderation requires a reason and is audited. Suspended owners cannot create resources or expose public cards, groups or images.

Create enabled plan versions and prices in the admin panel, select a trial plan and length if desired, then enable checkout/trials. Checkout and trials default off; quota enforcement defaults on. Plan prices use minor units (UGX zero decimals, KES/USD two). Billing is manual renewal, without automatic recurring debits. Existing subscriptions retain their purchased plan version. Trial eligibility is once per account; changing trial settings does not extend an existing trial.

## Enforcement and payments

Database transactions lock account usage before creation/restoration. Active cards/groups, monthly creations and storage bytes are enforced against the effective plan. Deleted creations do not refund monthly usage. The initial monthly baseline uses retained creation records; previously hard-deleted history cannot be reconstructed. Legacy images without measured sizes reserve 420,000 bytes each. Superadmins bypass quotas. Paid/trial expiry is evaluated at request time, falling back to Free without deleting saved content.

Pesapal is configured for live mode. Its credentials were validated without charging a payment. A separate Card Studio POST IPN was registered at the Vercel alias `/api/billing/ipn`; the existing MiniERP registration was preserved. Callback and IPN data never grant access directly: the server fetches payment status and checks amount, currency, reference and tracking ID. Fulfillment is transactional and idempotent. A durable submission claim prevents blind retries after an uncertain checkout request. Such orders need operational review before retrying; do not manually grant payment success from a browser return URL.

Required server variables: `PESAPAL_ENVIRONMENT`, `PESAPAL_CONSUMER_KEY`, `PESAPAL_CONSUMER_SECRET`, `PESAPAL_IPN_ID`, `BILLING_JOB_SECRET`. Vercel `CRON_SECRET` matches `BILLING_JOB_SECRET`. `NEXT_PUBLIC_SITE_URL` is the custom domain. Credentials stay in environment settings, never Git.

Daily Vercel maintenance at 03:00 UTC checks up to five oldest known pending/completed payments and expires subscriptions/orders. IPN is the primary immediate path. The Supabase `billing-maintenance` Edge Function is also deployed with explicit bearer-secret authentication and forwards to the same worker. Its environment requires `CARD_STUDIO_SITE_URL` and `BILLING_JOB_SECRET`. Increase scheduling throughput as payment volume grows. Missing provider tracking IDs from uncertain submissions require reconciliation with the merchant dashboard.

## Deployment and checks

The live database already contained SaaS and Clerk foundations although their migration-history entries were absent. Only commercial migrations were applied for this release. Do not blindly replay prerequisite migrations; reconcile historical entries against schema before using `db push`.

Local validation: lint, production build and 45 tests; transactional Postgres tests cover quotas, trial eligibility/expiry, access control, moderation, payment amount spoofing, repeated fulfillment and reversal. Responsive DOM checks covered 375/768/1440 widths, mobile dropdowns, Escape dismissal and keyboard feature tabs. No real payment was charged; a paid transaction and merchant settlement remain operational acceptance checks after catalog configuration.

Security advisor found no public table/function security warnings. Its existing legacy Supabase Auth leaked-password warning remains; application login uses Clerk. Reference: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection .

For rollback, restore compatible application code while retaining ownership, RLS, payment ledger and quota migrations. Do not delete commercial history or relax authorization to resolve deployment errors.
