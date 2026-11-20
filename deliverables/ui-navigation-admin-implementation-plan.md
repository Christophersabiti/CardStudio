# Card Studio: navigation, onboarding, plan visibility and admin portal

Implementation plan, 20 November 2026. Branch reviewed: `feat/estamp-builder-admin-quota`.
**Status:** Phase 1 and Phase 5 are implemented on this branch, not yet committed. Built 20 November 2026. Still open from those phases: the signed-in menu, account links and phone tab bar have not been seen working in a browser, because local sign-in needs Clerk development keys. Brand image files were kept because `scripts/build-brand-assets.mjs` and the favicon set use them. `/auth/callback` and `/auth/confirm` stay for one more release.

Also included, approved after the build:
- While sign-in loads, the header shows an "Account" link instead of an empty space.
- Print package links to a new short explainer page (`/explore/print-package`) that says it is for Basic and Premium plans.

## 1. What the review found

Evidence comes from the source code and from running the local app at desktop width and at 375 px.

### Navigation (the main problem)

The app has **two unrelated menus**, so the site changes shape as soon as someone clicks "Create your card":

| | Marketing menu (`components/marketing/Navigation.tsx`) | App menu (`components/Header.tsx`) |
|---|---|---|
| Used on | `/`, `/pricing`, `/explore/*`, `/stamp-maker`, `/email-signature`, `/onboarding` | `/studio`, `/qr-studio`, `/dashboard*`, `/billing`, `/admin`, `/c/*`, `/g/*`, sign-in/up |
| Items | Solutions, Products, Resources, Company, Pricing | Create card, QR Studio, Stamp maker, Email signature, Pricing, + 4 account links |
| Mobile | Has a "Menu" toggle (text button, no icon) | **No mobile menu.** Links wrap onto 2–3 lines and take about 140 px of a 812 px phone screen |
| Signed-in state | One "My cards" link | My cards, My QR codes, Billing, avatar — no plan shown |

Other menu problems:
- The marketing menu groups by *company structure* (Solutions/Company) instead of *what the user wants to do*. A beginner looking to "make a QR code" has to guess that it lives under Products → "QR sharing".
- "Products" includes **Event lead capture**, labelled "Coming soon". It is not sold.
- "Company" holds Careers ("no open positions") and About pages that add menu depth without helping anyone create anything.
- Dropdowns open on hover and on click with mixed logic (`e.detail > 0 && hover`), which makes a second click close-and-reopen on some touch laptops.
- The app header shows "Card Studio · Digital business cards & contact QR" as a second line, which crowds the header on phones.

### Responsive layout
- `/studio` at 375 px is **8 px wider than the screen** (`scrollWidth` 383): the editor fieldset and "Updates as you type" label overflow, and "Print package" is pushed off the right edge.
- The live preview, orientation and theme toggles appear *before* the form on phones, so the first thing a beginner sees is controls, not "enter your name".
- The marketing home page fits a phone correctly.

### Plan visibility (Free / Basic / Premium)
- The plan name only appears inside `UsageBanner`, which renders on `/dashboard`, `/studio` and `/billing` after a client fetch. It never appears in the menu or profile.
- The avatar menu is Clerk's default `UserButton` linking to `/dashboard/account`, which renders Clerk's raw `<UserProfile>` with a one-line heading. There is no plan, no renewal date, no clear "Change photo / name", "Change password" or "Sign out" entry points written in plain language.

### Onboarding and help
- No tooltips, guided tour, empty-state guidance or "what can I make here?" page exists anywhere.
- The home page hero has a single CTA ("Create your card"). QR codes, stamps, email signatures and group contacts are only discoverable through the dropdown.

### Admin portal (`app/admin/page.tsx`, 413 lines)
- Tabs exist: Overview, Accounts, Cards & groups, Plans & pricing, E-stamp pricing, Settings, Orders, Activity.
- **Accounts tab shows no email, no plan, no join date, no search.** Rows show display name, Clerk ID and internal UUID only, so you cannot find a customer.
- Admins can change role and status only. There is **no way to grant a plan** to someone who paid by mobile money or cash.
- The database blocks it today: `subscriptions.provider` only allows `pesapal` or `paypal` (`20260906085317_saas_foundations.sql:68`). `effective_plan()` already returns any `active` subscription whose `current_period_end > now()`, so once a manual provider is allowed, a grant takes effect immediately with no other plan logic changes.
- There is no feature on/off control (e.g. hide Stamp maker, pause QR Studio), only quota/checkout/trial toggles.

### Inactive code and unsold features
A module scan found **no orphaned components or library files**: every file in `components/` and `lib/` is imported. The inactive surface is routes, menu entries, data and assets:

| Item | Status | Action |
|---|---|---|
| `app/api/auth/signin`, `app/api/auth/password` | Return 410 "moved" | Delete after confirming no traffic in Vercel logs |
| `app/auth/callback`, `app/auth/confirm` | Redirect old Supabase links to `/sign-in` | Keep 1 more release, then delete |
| `app/auth/signout` | "Compatibility for an older open tab", no callers | Delete |
| `app/login` | Redirects to `/sign-in`, still linked in 3 places | Point those links to `/sign-in`, keep redirect |
| Event lead capture (`lead-capture`) | "Coming soon", not sold | Remove from menu, footer and `featureCopy` |
| Enterprise page | "On the roadmap" | Replace with a "Contact sales" line on Pricing |
| Careers page | No positions | Remove from menu; keep the URL as a redirect to About |
| `paypal` provider in schema | No PayPal code exists | Leave in constraint (harmless); do not show in UI |
| `public/brand/card-studio-logo-*`, `card-studio-icon.png`, `icon-16/32/512.png` | Not referenced in code | Check the manifest/OG use first, then delete the unused ones |
| `Claude outputs/` folder in repo root | Stray env example | Delete (it is not ignored by git) |

**What is actually being sold** (the product list the new menu and home page should show): Digital business card, Dynamic QR codes (QR Studio: event, place, links, image, video), Group / team contacts (CSV import), Email signature, E‑stamp maker, Print package. Plans: Free, Basic, Premium, plus a free trial.

### Local environment note
`.env.local` uses Clerk **production** keys, which only work on `cardstudio.sabtechonline.com`. Locally, sign-in and every signed-in page render blank. Add Clerk development keys to `.env.local` before building the signed-in parts of this plan, or they cannot be verified locally.

## 2. Design skills to use

Already installed on this machine (no download needed):
- **`ui-ux-pro-max`** (GitHub: nextlevelbuilder/ui-ux-pro-max-skill): navbar, sidebar, dashboard, admin panel and accessibility patterns. Use it for the menu, the profile card and the admin layout.
- **`design-review`** and **`plan-design-review`** (gstack): run a visual QA pass after each phase, at 375, 768 and 1280 px.
- **`design:accessibility-review`**: keyboard, focus and contrast checks on the new menu and tour.

Worth adding from GitHub: Anthropic's **`frontend-design`** skill (anthropics/skills) for distinctive, non-generic UI. Installing it is optional and needs your OK.

## 3. Target information architecture

One header component for the whole site. It changes based on whether someone is signed in.

**Signed out**
```
[logo] Create ▾   Pricing   Help        Sign in   [Start free]
```
`Create ▾` opens a visual panel with one thumbnail tile per product. Each tile has a one-line "what it is" and a "Start" button:
Business card · QR code · Team contacts · Email signature · E‑stamp · Print package.

**Signed in**
```
[logo] Create ▾   My work ▾   Help     [Free plan · Upgrade]  (avatar ▾)
```
- `My work ▾`: My cards, My QR codes, My stamps, Trash.
- **Plan badge** is always visible: `Free`, `Basic`, `Premium · renews 20 Dec`, `Trial · 5 days left`, or `Premium (manual) · ends 20 Dec`. Free and expiring plans show "Upgrade".
- **Avatar menu** (custom, wraps Clerk): name, email and plan at the top, then *Edit profile & photo*, *Change password*, *Billing & usage*, *Administration* (admins only), *Sign out*.

**Phones (< 768 px)**: logo, plan badge and a hamburger icon. The hamburger opens a full-height sheet with the same groups as large tap targets (minimum 44 px), the Create tiles in a 2-column grid, and Sign out at the bottom. On the signed-in pages, a **bottom tab bar** gives one-tap access: Home · Create · My work · Account.

## 4. Implementation phases

Each phase is shippable on its own and ends with `npm run typecheck`, `npm run lint`, `npm test` and `npm run build`.

### Phase 1: Unified, responsive navigation (about 3 days)
1. Create `lib/navigation.ts` as the single source for products (`slug`, title, one-liner, href, icon, thumbnail, `sold: boolean`), help links and "My work" links. Replace the `navigation` object in `lib/marketing.ts`.
2. Build `components/nav/SiteHeader.tsx` (server) with `CreateMenu.tsx`, `MobileSheet.tsx`, `AccountMenu.tsx` and `PlanBadge.tsx` (client). Use click-to-open menus with `aria-expanded`, Escape to close, focus return and focus trapping inside the mobile sheet. Remove the hover/click mixing.
3. Replace `components/Header.tsx` and `components/marketing/Navigation.tsx` with `SiteHeader` on every page. Keep the brand-preset logo logic from `Header.tsx` (neutral, PMI Uganda and Sabtech presets must keep working).
4. Add `components/nav/BottomTabs.tsx` to the signed-in pages on phones.
5. Fix the 8 px overflow on `/studio`. On phones, put the form first and the preview second, behind a sticky "Preview" button.
6. Remove Lead capture, Enterprise and Careers from the menu and footer.

### Phase 2: Plan badge and profile card (about 2 days)
1. Add `lib/billing/account-plan.ts` (server-only). It returns `{code, name, source: 'free'|'trial'|'paid'|'manual', endsAt, daysLeft}` using `effective_plan()`, `subscriptions` and `account_trials`. `/api/usage` and the billing page reuse it, so the calculation lives in one place.
2. Render the plan badge server-side in `SiteHeader`, so there is no flash of "no plan" while the client fetch runs. Keep the `card-studio-usage` event to refresh it after creating things.
3. Rebuild `/dashboard/account` as an **Account** page with a profile card at the top: photo, name, email, plan, renewal/end date, usage bars and an Upgrade button. Under it, give each task its own clearly labelled section with Clerk's `<UserProfile>` pages mounted in tabs: *Profile* (name, photo), *Security* (change password, sessions, two-step), *Billing* (links to `/billing`). Use plain-language headings: "Change your password" rather than "Security".
4. Replace `UserButton` with the custom `AccountMenu`. Use Clerk's `SignOutButton` and `openUserProfile` so identity actions stay in Clerk.

### Phase 3: Home page, product thumbnails and guided walkthrough (about 3 days)
1. Home page: keep the hero, then add a **"What do you want to make?"** grid of six product thumbnail cards with a live mini-preview illustration and a "Start" link each, then a 3-step "Create → Share → Update" strip and the pricing teaser.
2. Signed-in **dashboard home** (`/dashboard`): a welcome card with the plan, a "Create something" tile row, and recent items across cards, QR codes and stamps. Empty states explain the next step ("You have no QR codes yet. A QR code can open an event, a map, links or a video. Create one").
3. **Walkthrough**: a small dependency-free tour component (`components/tour/Tour.tsx`: spotlight, step tooltip, Next/Back/Skip, keyboard support, respects `prefers-reduced-motion`). Tours to ship:
   - *First visit to /studio*: name and photo → preview → save draft → publish → QR download.
   - *First visit to /qr-studio*: choose type → content → style → publish → download.
   - *Stamp maker* and *Email signature*: 3 steps each.
   Completion is stored per user in a new `profiles.onboarding_state jsonb` column (guests use `localStorage`). A "?" Help button in the header restarts the tour for the current page.
4. **Inline tooltips**: an accessible `InfoTip` (button-triggered, works on touch, not hover-only) next to confusing terms: "Dynamic vs offline QR", "Publish vs save draft", "Group consent", "Print package".

### Phase 4: Admin portal upgrade (about 4 days)
1. **Database migration** (create with the Supabase CLI, `npx supabase migration new admin_manual_grants`):
   - Allow `provider = 'manual'` on `subscriptions` and `payments`.
   - New table `manual_grants(id, owner_id, plan_id, granted_by, starts_at, ends_at, amount_minor, currency, payment_reference, note, revoked_at, revoked_by, created_at)`.
   - New `security invoker` function `admin_grant_plan(actor, target, plan_id, months, payment_reference, note)`. It locks the subscription row, sets `plan_id`, `status='active'`, `provider='manual'`, `renewal_mode='manual'`, and sets `current_period_end` to `greatest(now(), current_period_end) + months` so an existing paid period is extended, not cut short. It writes `manual_grants`, `subscription_events` and `admin_audit`. Execute rights go to `service_role` only.
   - `admin_revoke_grant(actor, grant_id, reason)` ends the period now and falls back to Free.
   - `feature_flags(key, enabled, updated_by, updated_at)` for: card builder, QR Studio, group contacts, email signature, stamp maker, print package, checkout.
   - An `admin_accounts` view or RPC that joins users, profile, Clerk email (synced via the existing webhook into `profiles.email`), effective plan, period end, and card/QR/stamp counts, with search and pagination.
2. **API**: add `grant_plan`, `revoke_grant` and `feature_flag` actions to `app/api/admin/commercial/route.ts` and `lib/billing/validation.ts`. Keep the existing superadmin check, origin check and rate limit, and identify the actor from the verified session only.
3. **Admin UI**: move from one 413-line page to `app/admin/(portal)/layout.tsx` with a left sidebar (collapses to a drawer on phones) and separate pages:
   - **Overview**: user totals by plan, new sign-ups (7/30 days), active premium users, grants expiring in 7 days, revenue from orders and manual grants.
   - **Users**: search by name or email; filter by plan, status and expiring soon. Each row shows email, plan badge, end date, item counts and joined date. The row opens a **user drawer** with profile, plan history, orders, grants and content, plus actions: *Grant plan* (plan, 1/3/6/12 months, payment reference, note, confirm dialog showing the new end date), *Extend*, *Revoke*, *Change role*, *Suspend*.
   - **Premium users**: the same table pre-filtered to paid, trial and manual plans, sorted by end date.
   - **Features**: on/off switches from `feature_flags`. Disabled products disappear from the menu and home grid, and their creation APIs return a 503 "temporarily unavailable" response. Existing published cards and QR codes keep working.
   - Existing tabs (Plans & pricing, E‑stamp pricing, Settings, Orders, Cards & groups, Activity) move into the sidebar unchanged.
4. **Expiry**: the existing `commercial_maintenance()` already expires subscriptions whose period ended, so manual grants expire automatically. Add an "expires in 3 days" banner for the user.

### Phase 5: Clean-up (about 1 day, can run in parallel with Phase 1)
Delete the retired routes and assets listed in section 1, remove `lead-capture`, `enterprise` and `careers` from the copy, delete `Claude outputs/`, and update README/docs. Check Vercel runtime logs for hits on `/api/auth/*` and `/auth/*` over the last 30 days before deleting.

### Phase 6: Verification (about 1 day)
- Unit tests: `account-plan` cases (free, trial, paid, manual, expired), grant extension maths, navigation config (only `sold` products shown), feature-flag gating.
- Integration (`npm run test:integration`): grant → effective plan becomes Premium → revoke → back to Free; a non-superadmin is rejected.
- Visual QA with `design-review` at 375 / 768 / 1280 px on home, studio, QR studio, dashboard, account, billing and admin; no horizontal scroll; keyboard-only run through every menu and the tour.

## 5. Decisions needed before starting
1. **Manual grant length**: fixed 1 month (as asked), or 1 / 3 / 6 / 12 months? The plan assumes the choice, with 1 month as the default.
2. **Who can grant plans**: superadmin only (current rule for commercial changes), or admins too?
3. **Walkthrough**: auto-start on first visit, or only when the user taps "Show me how"? The plan assumes auto-start once, then available from Help.
4. **Clerk development keys** for local testing (see section 1).

## 6. Order and effort
Phase 5 and Phase 1 → Phase 2 → Phase 4 → Phase 3 → Phase 6. Estimated total: about 14 working days. Phase 4 is ordered before Phase 3 because manual premium grants unblock revenue that is collected outside the system.
