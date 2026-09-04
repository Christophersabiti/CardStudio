/**
 * White-label brand configuration.
 *
 * Switch the active brand with the NEXT_PUBLIC_BRAND env var ("neutral" | "pmi" |
 * "sabtech"), or add your own preset below. Colors flow into Tailwind via CSS
 * variables set in app/layout.tsx, so every `brand-*` utility updates at once.
 */
export interface Brand {
  key: string;
  name: string;
  tagline: string;
  /** path under /public, or "" to render the name as text only */
  logo: string;
  colors: {
    primary: string;
    primaryDeep: string;
    secondary: string;
    secondaryDeep: string;
    accent: string;
  };
}

export const BRANDS: Record<string, Brand> = {
  neutral: {
    key: "neutral",
    name: "Card Studio",
    tagline: "Digital business cards & contact QR",
    logo: "",
    colors: {
      primary: "#4F46E5", // indigo
      primaryDeep: "#3730A3",
      secondary: "#0F172A", // slate ink
      secondaryDeep: "#020617",
      accent: "#F59E0B", // amber
    },
  },
  pmi: {
    key: "pmi",
    name: "PMI Uganda Chapter",
    tagline: "Digital business cards & contact QR",
    logo: "/brands/pmi-uganda.png",
    colors: {
      primary: "#F26A21", // PMI orange
      primaryDeep: "#D8541A",
      secondary: "#822C8E", // PMI purple
      secondaryDeep: "#5E1F6A",
      accent: "#0FA3B1", // crane teal
    },
  },
  sabtech: {
    key: "sabtech",
    name: "Sabtech Online",
    tagline: "Data & technology learning",
    logo: "",
    colors: {
      primary: "#0EA5E9", // sky
      primaryDeep: "#0369A1",
      secondary: "#0B1220",
      secondaryDeep: "#020617",
      accent: "#22C55E",
    },
  },
};

export const activeBrand: Brand =
  BRANDS[process.env.NEXT_PUBLIC_BRAND ?? "neutral"] ?? BRANDS.neutral;

/** CSS variables injected on <body> so Tailwind `brand-*` utilities resolve. */
export function brandCssVars(brand: Brand): Record<string, string> {
  return {
    "--brand-primary": brand.colors.primary,
    "--brand-primary-deep": brand.colors.primaryDeep,
    "--brand-secondary": brand.colors.secondary,
    "--brand-secondary-deep": brand.colors.secondaryDeep,
    "--brand-accent": brand.colors.accent,
  } as Record<string, string>;
}
