import type { Brand } from "./brand";
import type { CardData } from "./types";

export type ColorPair = [string, string];
export const isHexColor = (value: string) => /^#[\da-f]{6}$/i.test(value);
const rgb = (hex: string) => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const hex = (values: number[]) => "#" + values.map(v => Math.round(v).toString(16).padStart(2, "0")).join("");
export function mix(a: string, b: string, amount: number): string {
  const other = rgb(b);
  return hex(rgb(a).map((v, i) => v * (1 - amount) + other[i] * amount));
}
export function contrast(a: string, b: string): number {
  const luminance = (color: string) => rgb(color).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
export function readable(seed: string, backgrounds: string[], dark: boolean): string {
  for (let step = 0; step <= 100; step++) {
    const color = mix(seed, dark ? "#ffffff" : "#000000", step / 100);
    if (backgrounds.every(bg => contrast(color, bg) >= 4.6)) return color;
  }
  return dark ? "#ffffff" : "#000000";
}

/** Reduce vivid chroma before deriving broad surfaces; retain the logo's hue. */
export function soften(color: string): string {
  const channels = rgb(color);
  const mid = (Math.max(...channels) + Math.min(...channels)) / 2;
  return hex(channels.map(v => mid + (v - mid) * .58));
}

/** Alpha-weighted quantization prevents transparent/white padding from winning. */
export function extractLogoColors(pixels: ArrayLike<number>): ColorPair | undefined {
  const bins = new Map<string, { count: number; total: number[]; saturation: number }>();
  for (let i = 0; i + 3 < pixels.length; i += 4) {
    const channels = [pixels[i], pixels[i + 1], pixels[i + 2]];
    const alpha = pixels[i + 3] / 255;
    const max = Math.max(...channels), min = Math.min(...channels);
    if (alpha < .5 || min > 242) continue;
    const key = channels.map(v => Math.floor(v / 24)).join(":");
    const bin = bins.get(key) || { count: 0, total: [0, 0, 0], saturation: (max - min) / 255 };
    bin.count += alpha;
    channels.forEach((v, j) => bin.total[j] += v * alpha);
    bins.set(key, bin);
  }
  const all = [...bins.values()];
  // Prefer a genuine brand hue over black lettering, but discard isolated noise.
  const colored = all.filter(b => b.saturation > .12 && b.count >= Math.max(2, pixels.length / 4 * .005));
  const ranked = (colored.length ? colored : all).sort((a, b) => b.count * (1 + b.saturation) - a.count * (1 + a.saturation));
  if (!ranked.length) return undefined;
  const primary = hex(ranked[0].total.map(v => v / ranked[0].count));
  const distinct = ranked.find(b => {
    const c = b.total.map(v => v / b.count), p = rgb(primary);
    return Math.sqrt(c.reduce((sum, v, i) => sum + (v - p[i]) ** 2, 0)) > 85;
  });
  return [primary, distinct ? hex(distinct.total.map(v => v / distinct.count)) : mix(primary, "#182235", .35)];
}

export function resolveCardColors(data: CardData, detected?: ColorPair): ColorPair | undefined {
  const appearance = data.appearance;
  if (appearance?.mode === "theme") return undefined;
  if (appearance?.mode === "custom") return [appearance.primary, appearance.secondary];
  if (!data.logo) return undefined;
  return data.logoColors || detected;
}

export function cardPalette(colors: ColorPair, dark: boolean) {
  const [primary, secondary] = colors.map(soften);
  const surface = dark ? "#191b23" : "#ffffff";
  const start = mix(surface, primary, dark ? .10 : .055);
  const end = mix(surface, secondary, dark ? .06 : .025);
  const asideStart = mix(dark ? "#141925" : "#1b2232", primary, dark ? .20 : .28);
  const asideEnd = mix("#0b101b", secondary, dark ? .12 : .18);
  return {
    surfaceStart: start, surfaceEnd: end,
    ink: dark ? "#f3f4f7" : "#1a1720",
    muted: readable(dark ? "#b5b9c5" : "#686574", [start, end], dark),
    title: readable(primary, [start, end], dark),
    icon: readable(primary, [mix(start, primary, .10)], dark),
    iconBg: mix(start, primary, .10),
    line: mix(surface, primary, dark ? .30 : .20),
    asideStart, asideEnd, asideGlow: asideStart,
    asideText: "#ffffff",
    asideMuted: readable("#c4c7d0", [asideStart, asideEnd], true),
    accentStart: mix(primary, dark ? "#ffffff" : "#182235", dark ? .20 : .12),
    accentMiddle: mix(primary, secondary, .5),
    accentEnd: mix(secondary, dark ? "#ffffff" : "#182235", dark ? .15 : .12),
  };
}

export function cardColorVars(colors: ColorPair | undefined, brand: Brand): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const dark of [false, true]) {
    const scheme = dark ? "dark" : "light";
    if (colors && colors.every(isHexColor)) {
      for (const [key, value] of Object.entries(cardPalette(colors, dark))) vars[`--card-${key}-${scheme}`] = value;
    } else {
      // Preserve the current theme, correcting its text/icons for dark surfaces.
      const surface = dark ? "#1d1922" : "#ffffff";
      const iconBg = mix(surface, brand.colors.secondary, .12);
      vars[`--card-title-${scheme}`] = readable(brand.colors.primaryDeep, [surface], dark);
      vars[`--card-icon-${scheme}`] = readable(brand.colors.secondary, [iconBg], dark);
      vars[`--card-iconBg-${scheme}`] = iconBg;
    }
  }
  return vars;
}
