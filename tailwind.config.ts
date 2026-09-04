import type { Config } from "tailwindcss";

/**
 * Brand colors are driven by CSS variables set in app/layout.tsx from lib/brand.ts.
 * This keeps the app white-label: switch the active brand (or its palette) in one
 * place and every Tailwind `brand-*` utility follows.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "var(--brand-primary)",
          "primary-deep": "var(--brand-primary-deep)",
          secondary: "var(--brand-secondary)",
          "secondary-deep": "var(--brand-secondary-deep)",
          accent: "var(--brand-accent)",
        },
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
