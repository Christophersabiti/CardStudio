# Standard prompt: emoji-free UI

Audit the entire application UI and remove all emojis from application-owned content, including navigation, buttons, headings, forms, placeholders, tooltips, notifications, empty states, dashboards, previews, and mobile layouts. Check shared components, default data, Unicode escapes, HTML entities, and CSS-generated content.

Remove purely decorative emojis. Where an icon communicates an action or state, replace it with an appropriate SVG icon from the existing icon system. Use consistent sizing, stroke, color, and alignment. Hide decorative icons from assistive technology and provide accessible names for icon-only controls. Preserve meaningful labels and functionality.

Keep the existing branding, layout, responsive behavior, routes, and interactions. Preserve user-entered content and legitimate punctuation, currency, and copyright symbols. Avoid introducing new dependencies or unrelated redesigns.

Check for remaining emojis, inspect changed desktop and mobile screens where available, and run the appropriate lint and type checks. Report what changed and any verification limitations.
