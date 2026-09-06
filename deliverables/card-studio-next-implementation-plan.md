# Card Studio: pricing, account journeys and card management

Status: implementation-ready proposal; no application changes made for this review.
Reviewed: 6 September 2026. Baseline: commit f5a9551.

## Benchmark and direction

Wave’s public pricing page presents Free, Pro, Teams and Enterprise, a monthly/yearly selector, audience descriptions, trial/start buttons, grouped feature comparison and FAQ. It displays Free at $0, Pro at $7/month and Teams at $5/user/month with a three-seat minimum; Enterprise is sales-led. Currency is USD. These are the rendered page’s displayed prices; the extracted page does not establish the selected billing toggle or annual total. Verify the interactive selection before quoting annual savings. Wave distinguishes professional customization from team administration and enterprise identity management. Source: [Wave pricing](https://wavecnct.com/pricing).

HiHello documents four cards on Free and sixteen on Professional, illustrating an understandable capacity-based upgrade. Source: [HiHello card allowances](https://support.hihello.com/hc/en-us/articles/12207805207323-How-many-cards-can-I-create-in-my-HiHello-account).

Card Studio should adopt clear plan comparison, visible usage and purposeful upgrade paths. Its prices, currency, allowances and trials remain superadmin-controlled. Do not import competitors’ prices, invent discounts or advertise features we do not provide. Current Card Studio group contacts are not multi-user team seats. Seat billing, SSO, CRM sync and enterprise provisioning remain separate future work.

The supplied gallery image is the visual reference for thumbnails: portrait/initials, name, role, organization, status and an overflow menu. Neither the reviewed pricing page nor that screenshot establishes competitor behavior for idle logout, search, export authentication or orientation persistence. Those are explicit Card Studio requirements and proposed acceptance standards, not verified Wave features.

## Current gaps established from code

| Area | Existing behavior | Required outcome |
|---|---|---|
| Export controls | Studio enables CardActions/GroupActions when content is valid, even for guests | Sign-in required for every highlighted export/save action |
| Signup | Clerk SignUp redirects directly to dashboard | Plan selected during onboarding, preserved through authentication |
| Pricing | Basic catalog cards; Free links to studio, paid to billing | Detailed comparison, billing-period choice, plan-specific onboarding |
| Upgrades | Usage primarily on billing page | Visible Free upgrade and contextual near-limit prompts |
| Layout | CardData has no orientation field | Explicit portrait/landscape saved with content |
| My cards | Text panels with local Trash filter; independently paginated cards/groups | Shared list/gallery, global owner-scoped search and correct pagination |
| Session | Server checks Clerk session/user status | Enforced 15-minute inactivity policy plus synchronized UI logout |

Relevant implementation areas: components/Studio.tsx, CardActions.tsx, GroupActions.tsx, CardPreview.tsx, Dashboard.tsx; app/pricing/page.tsx, app/sign-up/[[...sign-up]]/page.tsx, app/dashboard/page.tsx; lib/auth/session.ts, lib/types.ts, lib/validation.ts and lib/billing/*.

## Phase A — Authentication and idle-session enforcement

Priority: first release, addressing the exposed export controls.

1. Disable Add to contacts, Save QR image, Copy vCard and Save Digital Card whenever authentication is loading, absent or expired. Apply the same rule to group exports, cloud save and publish. Use native disabled states, muted styling and persistent explanatory text: “Sign in to save or download your card.” The separate Sign in to save link stays enabled so visitors can authenticate.
2. Add execution-time guards to each export handler, including a fresh server session check before download/copy. A stale page must not export after logout. Existing cloud write APIs continue verifying identity and owner authorization.
3. Guests may edit and preview a local draft. This is not permission to upload private media or save to the cloud. Claim a guest draft only after successful sign-in and explicit continuation; never merge it silently into an existing card.
4. Interpret “no user” consistently: public profiles remain viewable, but any export/contact-save controls they expose also require sign-in. A published QR/profile remains public. Disabling app exports cannot prevent operating-system screenshots or copying already-public content.
5. Enforce 900 seconds without user interaction. Warn at 840 seconds with a visible one-minute countdown and “Stay signed in.” Keyboard, pointer/touch and deliberate scrolling count as activity; polling, rendering, animations, network requests and simply returning to a tab do not reset the deadline.
6. Synchronize activity/logout across tabs in the same browser session. Recheck wall-clock expiry before rendering private content on focus/resume and before any action; handle sleeping devices and throttled background timers. At expiry hide private content, revoke the active Clerk session, clear private caches and route to sign-in with a safe local return URL. Other devices retain their independently active sessions.
7. Keep the authoritative idle timestamp server-side, keyed to the verified session. An authenticated activity endpoint may refresh a still-valid session but must never revive an expired one. Protected APIs enforce elapsed time atomically; browser clocks are not authoritative. A browser timer alone is insufficient.
8. Clerk documents that production inactivity settings require a paid plan and consider a user inactive when the app closes or stops refreshing tokens. This is different from 15 minutes without human interaction. Verify the instance’s available settings; use provider timeout/revocation as defense in depth while enforcing the application interaction rule separately. Do not silently accept a longer timeout if unavailable. [Clerk session options](https://clerk.com/docs/guides/secure/session-options).
9. Autosave valid existing-card edits using the established draft/revision flow while active; do not auto-publish or create quota-consuming cards on logout. Preserve recoverable unsaved work under the same owner, preferably as a private server recovery draft; it must not be visible to the next signed-in account. Clear plaintext private browser drafts at logout after secure recovery succeeds; warn while active when recovery fails. Guest drafts remain separate. Never postpone security expiry because saving failed.

Acceptance: guest buttons disabled by mouse and keyboard; no handler exports when a session expires; API requests fail after 900 seconds even if JavaScript timers are stopped; background requests do not extend the deadline; active second tab prevents premature logout; “Stay signed in” at 899 seconds succeeds, at 901 seconds requires authentication; offline/sleep resume hides private UI; superadmins follow the same rule.

## Phase B — Pricing, plan selection and upgrade journey

Depends on Phase A session checks; reuses current catalog, trial and verified Pesapal fulfillment.

Pricing screen, in order:
- Short explanation of who each plan suits.
- Monthly/yearly control only when corresponding enabled prices exist; explicit currency and total payable. Show a monthly equivalent for annual prices only alongside the annual total. Savings calculated from real comparable prices.
- Plan cards: name, audience, current/recommended label, amount, billing period, active-card allowance, monthly creations, groups, storage, trial eligibility and a precise action.
- Feature matrix grouped into Creation, Sharing/export, Capacity, Account/security and Support. All display-only feature claims must reflect implemented capabilities. No empty checkmarks or paid promises without entitlement enforcement.
- FAQs covering quota counting/reset, published versus private drafts, trial expiry, manual renewal, payment confirmation, downgrades and retained content.

Superadmin additions: audience/description, display order, recommended flag, comparison feature descriptions and upgrade relationships. Keep existing immutable plan/price versions. Presentation changes must not rewrite purchased entitlements. Define actual gated capabilities separately from descriptive copy. Publish only complete enabled offers.

New account journey:
1. Pricing → choose Free or an enabled paid price/trial → sign up → verify email → complete plan onboarding → studio/dashboard.
2. Direct sign-up links lead to pricing first. OAuth or externally initiated account creation without a choice lands on a required plan-selection step after authentication.
3. Preserve only an opaque plan/price intent and safe return destination through redirects. Revalidate price, availability and eligibility server-side after authentication. A modified query string never grants paid access.
4. Free confirmation records onboarding completion. Paid confirmation starts the existing Pesapal flow; grant paid benefits only after independent provider verification. Eligible trials start only on an explicit trial action, using existing one-time eligibility.
5. Cancelled/failed/pending checkout shows status, retry/resume where safe, and “Continue with Free.” Never show a paid plan as active just because it was selected. If an offer changed, display the new terms and ask for a fresh choice.
6. Existing accounts retain subscriptions and bypass compulsory reselection. Distinguish acquisition onboarding from upgrades. Expired sessions preserve purchase intent; the payment IPN can still complete independently.

Upgrade visibility:
- Free: persistent Upgrade action on My cards, studio and billing whenever a purchasable higher-capacity offer exists.
- Lower paid plan: show a usage prompt when any finite quota reaches 80% (proposed default, editable only by superadmin). Show actual metric, used/limit and reset date where applicable.
- At 100%: block only the constrained operation with the relevant reason and Upgrade action. Existing edits, viewing and permitted exports continue. Storage only blocks additional bytes; active-card limits affect creation/restore/duplication; monthly creation does not reset on deletion.
- Recommend plans using configured upgrade relationships and sufficient remaining capacity for the attempted action, not price alone. Exclude disabled offers and trials for ineligible users. Prevent a recommendation that increases one limit but reduces another without clear disclosure.
- If checkout is disabled or no higher offer exists, show a truthful capacity message and available billing/support path, not a dead Upgrade button. Top-tier users get usage and management guidance.
- Refresh usage after creation, duplication, restoration, upload, deletion, trial changes and payment fulfillment. Database quota enforcement stays authoritative against concurrent requests.

Acceptance: every signup route handles missing/invalid plan intent; Free activation and cancelled payment are recoverable; tampered prices never change charges; repeated returns never double-activate; 79%/80%/100%, zero and unlimited quotas render correctly; no dead checkout links; lower limits after expiry preserve cards and enforce only relevant new operations.

## Phase C — Portrait and landscape persistence

Add a two-option accessible control next to Live preview, available for individual cards on all plans. Proposed initial default: landscape, preserving current behavior. Mobile screen width scales the selected composition; it does not change the saved orientation.

Persist `orientation: 'portrait' | 'landscape'` in card content. Validate both values, include orientation in new defaults, local recovery, dirty comparisons, duplication, save and published snapshots. Missing orientation on legacy records resolves to landscape without unnecessarily rewriting existing published content.

Use one shared card renderer for live preview, published profile and export. Landscape uses the existing side-by-side composition; portrait stacks identity/contact information and QR. Scale consistently and preserve readable type, full contact details, QR quiet zones and logo proportions. Define fixed export width with content-safe height so long content is not cropped. Capture the selected card element by ref, not a global `.cs-print` selector that could target a thumbnail.

“Save private draft” stores the currently selected orientation. “Publish” publishes it. “Save Digital Card” exports the currently visible orientation. Changing a saved draft must not alter the published card until publishing. Standalone QR and vCard data do not change with orientation. Group contacts retain their existing presentation in this phase; the toggle is specifically for single-card layouts.

Acceptance: select portrait → save → reload/edit → portrait persists; duplicate retains orientation; public view changes only after publish; old cards remain landscape; both PNG orientations match the visible composition; exported QR decodes correctly; long names, many contact methods, no photo and image-load delays do not clip or capture the wrong card.

## Phase D — My cards gallery, list and keyword search

Toolbar: My cards/Trash, keyword search, accessible List/Thumbnails toggle and Create card. Include current plan/usage and contextual Upgrade from Phase B. Default thumbnails; remember the preference per user without storing card data in the preference. Keep query, status, sort and page in URL state.

Thumbnail reference: responsive 1/2/3-column cards with restrained cover area, photo or initials, name, designation, organization, location, publication status, orientation indicator and overflow actions. Do not invent departments or team membership from the reference image. The overview thumbnail is navigation, while the full renderer remains the source of exported card layout.

List view: name, organization, designation, publication status, last updated and actions. Mobile uses compact stacked rows without horizontal overflow. Both views provide identical edit, view-public, duplicate, unpublish, trash and restore capabilities, with existing confirmation and revision protection. Clearly distinguish “Private draft,” “Published,” “Unpublished changes” and “Trash.”

Search across the full signed-in owner’s collection, not just the loaded page. Include names, organization, title, location, tagline, role, phone/email, websites and social handles; for groups include group name, organization and member contact fields. Search draft content in the private dashboard. Never expose other owners’ records or return private search results through a public endpoint.

Implementation: server-side normalized searchable text maintained from JSON content on insert/update, with a suitable trigram index for substring matching. Use parameterized queries; escape wildcard syntax. Case-insensitive, trimmed, accent-tolerant where supported; all entered tokens must match somewhere in the record. Treat phone punctuation consistently. Minimum two characters for remote search, explicit guidance below that length, 250 ms debounce, bounded query length and stale-request cancellation.

Move My cards/Trash filtering before pagination. Replace the current two independent 30-record pages with one stable combined owner-scoped query ordered by updated_at plus a unique tie-breaker. Return 24 results and a matching total; reset page on filter/search change. Keep search and view choice across edit/back navigation. Empty collection, empty Trash, no matches, loading and failure each need distinct states.

Acceptance: matches beyond the first page appear; another owner’s keyword returns no records; multiword and punctuated contact searches work; pagination contains no duplicates/omissions; Trash counts reflect Trash only; switching view preserves query and results; 375/768/1440 layouts work with keyboard and screen-reader labels.

## Phase E — Integrated verification and release

Release sequence: A security fix first; B onboarding/pricing; C orientation; D management; then integrated acceptance. B–D may be developed independently after shared contracts are settled, but deployment order must preserve old clients and existing card data.

Required checks: meaningful session-boundary/integration tests, plan intent and payment replay tests, quota boundary/concurrency checks, search ownership/pagination tests, legacy orientation round-trip tests, exported QR decoding and browser checks in both layouts and both dashboard views. Verify direct API calls, browser back navigation, multiple tabs and mobile suspend/resume.

Roll out additive schema before dependent UI. Keep old fields compatible. Verify data counts and existing public links before/after migration. Gate larger UI changes for rollback; do not remove auth or quota controls as a fallback. Monitor authorization errors, checkout failures, quota denials, search latency and export failures without logging contact data, credentials or card contents.

Completion means all acceptance checks above pass on staging and production smoke tests pass. Real paid acceptance requires a deliberately approved low-value merchant test and verification of amount, entitlement and settlement; do not initiate a charge merely to test the UI.

## Proposed defaults ready to implement

- 15-minute idle logout for all authenticated roles; warning at 14 minutes.
- Auth required for all highlighted export/save actions, including any equivalent public-profile export controls; sign-in CTA remains enabled.
- Mandatory plan choice for new users; existing accounts retain their plans.
- Near-quota threshold 80%; superadmin configurable.
- Landscape for legacy/new defaults; both orientations available across plans.
- Thumbnails default, 24 results per page, server-side keyword search.
- No competitor price copied and no changes to configured live prices without superadmin action.

These are proposed implementation decisions, not changes already deployed. Approval of this plan authorizes its scope; implementation should proceed in the stated order.
