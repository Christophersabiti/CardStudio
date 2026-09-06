# Administration redesign — 7 September 2026

The control center now uses dedicated URL-backed tabs for Overview, Accounts, Cards & groups, Plans & pricing, Settings, Orders and Activity. Overview provides platform counts, payment/trial status, administrative shortcuts and an explicit unlimited-access badge. Customer plan creation is progressively disclosed; the current catalog is summarized in a table. Forms, tables, spacing, typography and focus states share a scoped indigo/slate administration style. Mobile tabs scroll within their navigation container, and summary cards/columns collapse at narrower widths.

Superadmins see unlimited access rather than Free-plan quotas in usage banners and billing. Their account does not need plan onboarding, a paid subscription or a trial. Personal checkout/trial endpoints reject these unnecessary purchases; customer billing configuration stays available in the control center. The database's existing superadmin quota exemption is unchanged, with a new regression test covering all six quota metrics. Ordinary account limits and access checks remain enforced.

Validation: lint, typecheck, production build and 51 tests passed. Authenticated visual review was not completed: the browser tool's automatic approval check timed out. No database migration, subscription cancellation or price changes were needed.
