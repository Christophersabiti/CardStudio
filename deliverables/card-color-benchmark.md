# Card color benchmark and implementation

## Reference benchmark

| Reference | Established pattern | Application in Card Studio |
| --- | --- | --- |
| [Material 3 color theming](https://github.com/material-components/material-components-android/blob/master/docs/theming/Color.md) | Distinct color roles for primary colors, containers, foregrounds, and light/dark appearances; content can provide the seed. | Extract two representative logo colors, then derive separate surface, accent, icon, and text colors. This is a lightweight implementation inspired by the role pattern, not Google's color-generation algorithm. |
| [Apple Dark Mode guidance](https://developer.apple.com/design/human-interface-guidelines/dark-mode) | Adapt foreground and background colors together and inspect both appearances. | Follow `prefers-color-scheme` automatically. Provide Device, Light, and Dark creator previews without saving a viewer-wide forced mode. |
| [WCAG 2.2 text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum) | Normal text needs at least 4.5:1 contrast. | Adjust generated foreground colors against their background roles; target 4.6:1 at endpoints to leave rounding headroom. Test intermediate gradient samples at 4.5:1. |

The restrained treatment below is Card Studio's design decision; the references do not prescribe these exact percentages. This benchmark compares implementation patterns, not product speed or a claim of full WCAG conformance.

## Creator experience

- **Color by logo (default):** uploading or replacing a logo extracts a matching palette. Existing cards without stored palette metadata sample their logo in the browser. Removing the logo restores the current theme.
- **Current theme:** explicitly retain the original brand palette, even with a logo.
- **Custom colors:** choose primary and companion colors through native color pickers. Custom choices are retained when switching modes and when replacing a logo.
- The matching colors affect the top accent, main background, personal-details gradient, title, icons, and borders. Social network marks keep their recognizable colors. The QR and the logo retain a white backing.
- Save/publish stores optional appearance and logo palette metadata with the existing card content. Private recovery uses the same validation. Existing records remain valid without a database migration. As before, draft edits require publication to change a shared card.
- Image exports use the currently rendered preview appearance. Contact files and QR payloads are unaffected by visual colors.

## Restrained color rules

1. Sample at most a 64 × 64 image while preserving the logo's aspect ratio. Weight pixels by opacity; ignore mostly transparent and near-white padding.
2. Quantize similar colors and prefer meaningful colored regions over black lettering. Ignore isolated color noise. If the logo is monochrome, use a neutral tonal pair; an all-white/transparent logo falls back to the current theme.
3. Reduce the RGB channel distance from the midpoint to 58% before deriving visual roles. This tempers saturated seeds while retaining their hue family.
4. Main backgrounds contain only 2.5–5.5% softened color in light mode and 6–10% in dark mode. Personal-detail backgrounds mix softened color into deep neutrals at 12–28%. No large surface uses a raw vivid logo color.
5. Use a 6px three-stop top accent that follows the same pair. A single-color logo gets a darker companion, avoiding a flat bright strip.
6. Adjust title and icon colors separately for contrast. Keep QR pixels unchanged on white. Never invert an uploaded logo for dark mode.

## Acceptance benchmark

| Scenario | Expected result |
| --- | --- |
| No logo / removed logo | Current brand theme; readable dark-mode title and icons |
| Transparent padding or white background | Visible brand regions supply colors rather than padding |
| Bright orange, yellow, green, cyan, magenta, red | Soft main tint and deep gradient, no solid fluorescent background |
| Black, gray, all-white logo | Neutral treatment or current-theme fallback; no extraction error |
| Two-color logo | Both colors influence top accent and background pairing |
| Logo replaced | New palette replaces old palette atomically; custom mode remains selected |
| Unreadable image | Card stays usable with current-theme fallback |
| Custom choices | Both color inputs update the preview and survive draft parsing |
| Device appearance changes | Card foregrounds and surfaces switch together without reloading |
| 375 / 768 / 1024 / 1440px widths | Card remains contained; creator controls remain usable |
| Generated foregrounds | At least 4.5:1 across sampled gradient positions |

Automated coverage in `tests/card-colors.test.ts` checks extraction, fallback, explicit modes, schema round trips and rejection, all three built-in brand text/icon fallbacks, and 242 generated palette/appearance combinations (11 primary × 11 companion × 2 appearances). Browser checks and build results are recorded with delivery. Stored palette metadata is browser-derived; extraction is approximate, so creators can override it with Custom colors.

## Verification results

- Production build and TypeScript passed; lint passed for all changed TypeScript files.
- All 78 repository tests passed, including the five new palette tests.
- Browser verified: two-color logo upload, automatic palette, custom orange color, Light/Dark previews, portrait/landscape layouts, reload recovery, explicit theme selection, and logo removal fallback.
- No horizontal overflow at 375, 768, 1024, or 1440px viewport widths.
- Local sign-in is unavailable with the configured production-only Clerk keys, so authenticated cloud publication and gated PNG download were not exercised in this browser session. Schema round trips and the existing publication flow are covered separately; rendering changes use the existing export path.
