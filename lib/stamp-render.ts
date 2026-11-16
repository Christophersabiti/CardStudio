import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";

// Server PNG export runs where no system fonts exist (e.g. Vercel), so SVG
// <text> would rasterize as empty boxes. Text is outlined with the bundled
// Noto Sans instead, matching the print package. The chosen display font only
// affects the browser preview.

type Font = ReturnType<typeof fontkit.create>;
type Point = [number, number];
export type StampItem = {
  id: string; text: string; place: "top" | "center" | "bottom"; curved?: boolean;
  size: number; bold: boolean; color?: string; letterSpacing: number;
  imageData?: string; imageScale?: number; imageX?: number; imageFit?: "contain" | "cover";
  dx?: number; dy?: number;
};
export type StampShape = "Circle" | "Oval" | "Rectangle" | "Square" | "Triangle" | "Shield" | "Hexagon" | "Octagon";
export type StampSvgDesign = { shape: StampShape; color: string; border: number; borderStyle: string; aging: number; items: StampItem[] };

const fontFile = (name: string) => path.join(process.cwd(), "assets", "print-package", name);
let fonts: Promise<{ regular: Font; bold: Font }> | undefined;
export function loadStampFonts() {
  return fonts ||= Promise.all([readFile(fontFile("NotoSans-Regular.ttf")), readFile(fontFile("NotoSans-Bold.ttf"))])
    .then(([a, b]) => ({ regular: fontkit.create(a), bold: fontkit.create(b) }))
    .catch(error => { fonts = undefined; throw error; });
}

const n = (v: number) => Number(v.toFixed(2));
const shape = (name: StampShape, i: number) => {
  switch (name) {
    case "Circle": return `<circle cx="250" cy="250" r="${185 - i}"/>`;
    case "Oval": return `<ellipse cx="250" cy="250" rx="${205 - i}" ry="${150 - i}"/>`;
    case "Rectangle": return `<rect x="${35 + i}" y="${100 + i}" width="${430 - 2 * i}" height="${300 - 2 * i}" rx="8"/>`;
    case "Square": return `<rect x="${65 + i}" y="${65 + i}" width="${370 - 2 * i}" height="${370 - 2 * i}" rx="10"/>`;
    case "Triangle": return `<polygon points="250,${52 + i} ${450 - i},${425 - i} ${50 + i},${425 - i}"/>`;
    case "Shield": return `<polygon points="${90 + i},${65 + i} ${410 - i},${65 + i} ${410 - i},285 250,${445 - i} ${90 + i},285"/>`;
    case "Hexagon": return `<polygon points="${145 + i},${52 + i} ${355 - i},${52 + i} ${450 - i},250 ${355 - i},${448 - i} ${145 + i},${448 - i} ${50 + i},250"/>`;
    case "Octagon": return `<polygon points="${155 + i},${45 + i} ${345 - i},${45 + i} ${455 - i},${155 + i} ${455 - i},${345 - i} ${345 - i},${455 - i} ${155 + i},${455 - i} ${45 + i},${345 - i} ${45 + i},${155 + i}"/>`;
  }
};

/** Same arcs as the browser preview, per shape. */
export function stampArcs(name: StampShape): { top: Point[]; bottom: Point[] } {
  if (name === "Rectangle" || name === "Square") return { top: [[85, 210], [250, 145], [415, 210]], bottom: [[85, 290], [250, 355], [415, 290]] };
  if (name === "Oval") return { top: [[70, 195], [250, 72], [430, 195]], bottom: [[70, 305], [250, 428], [430, 305]] };
  return { top: [[100, 205], [250, 112], [400, 205]], bottom: [[100, 295], [250, 388], [400, 295]] };
}

/** Arc-length lookup on a quadratic Bezier, as SVG textPath places glyphs. */
function curve([p0, p1, p2]: Point[]) {
  const pts: Point[] = [], len: number[] = [0];
  for (let k = 0; k <= 240; k++) {
    const t = k / 240, u = 1 - t;
    pts.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    if (k) len.push(len[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  }
  const total = len[len.length - 1];
  const at = (d: number) => {
    const target = Math.max(0, Math.min(total, d));
    let k = 1; while (k < len.length - 1 && len[k] < target) k++;
    const f = (target - len[k - 1]) / ((len[k] - len[k - 1]) || 1);
    const [a, b] = [pts[k - 1], pts[k]];
    return { x: a[0] + (b[0] - a[0]) * f, y: a[1] + (b[1] - a[1]) * f, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI };
  };
  return { total, at };
}

const starPoints = (cx: number, cy: number, outer: number, inner: number, points: number) =>
  Array.from({ length: points * 2 }, (_, k) => {
    const r = k % 2 ? inner : outer, a = Math.PI * k / points - Math.PI / 2;
    return `${n(cx + r * Math.cos(a))},${n(cy + r * Math.sin(a))}`;
  }).join(" ");
const SYMBOLS: Record<number, [number, number, boolean]> = { 0x2605: [5, .45, true], 0x2606: [5, .45, false], 0x2726: [4, .32, true], 0x2727: [4, .32, false] };

type Glyph = { adv: number; inner: string };
/** Glyph outlines relative to each glyph's baseline-left origin, in stamp units. */
function glyphs(font: Font, text: string, size: number, spacing: number): { width: number; list: Glyph[]; cap: number } {
  const s = size / font.unitsPerEm, cap = font.capHeight * s, list: Glyph[] = [];
  // Symbols are read from the source text: fontkit shares one missing-glyph
  // object, so its reported code points are unreliable.
  const segments: string[] = [];
  for (const ch of Array.from(text)) {
    if (SYMBOLS[ch.codePointAt(0)!] || !segments.length || SYMBOLS[segments[segments.length - 1].codePointAt(0)!]) segments.push(ch);
    else segments[segments.length - 1] += ch;
  }
  for (const segment of segments) {
    const symbol = SYMBOLS[segment.codePointAt(0)!];
    if (symbol) {
      const adv = size * .95, [points, ratio, filled] = symbol, r = size * .42;
      const poly = starPoints(adv / 2, -cap / 2, r, r * ratio, points);
      list.push({ adv: adv + spacing, inner: filled ? `<polygon points="${poly}"/>` : `<polygon points="${poly}" fill="none" stroke="currentColor" stroke-width="${n(size * .08)}"/>` });
      continue;
    }
    const run = font.layout(segment);
    run.glyphs.forEach((g, k) => {
      // Unsupported characters keep their spacing but draw nothing, never a box.
      const adv = (g.id === 0 ? font.unitsPerEm * .5 : run.positions[k].xAdvance) * s;
      const d = g.id === 0 ? "" : g.path.toSVG();
      list.push({ adv: adv + spacing, inner: d ? `<path transform="translate(${n(run.positions[k].xOffset * s)} 0) scale(${n(s * 1000) / 1000} ${-n(s * 1000) / 1000})" d="${d}"/>` : "" });
    });
  }
  const width = list.reduce((sum, g) => sum + g.adv, 0) - (list.length ? spacing : 0);
  return { width, list, cap };
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);

/** Builds the export SVG. `images` maps item ids to embeddable data URLs. */
export async function stampSvg(design: StampSvgDesign, images: Map<string, string> = new Map()): Promise<string> {
  const { regular, bold } = await loadStampFonts();
  const arcs = stampArcs(design.shape);
  const dash = design.borderStyle === "Dotted, office" ? "1 7" : design.borderStyle === "Serrated, notary" ? "2 3" : "";
  const body = design.items.map(item => {
    const y = item.place === "top" ? 190 : item.place === "bottom" ? 310 : 250;
    const move = `translate(${item.dx || 0} ${item.dy || 0})`;
    const img = images.get(item.id);
    if (img) {
      const scale = item.imageScale || 1, w = 210 * scale, h = 84 * scale, cx = 250 + (item.imageX || 0);
      return `<g transform="${move}"><image href="${esc(img)}" x="${n(cx - w / 2)}" y="${n(y - h / 2)}" width="${n(w)}" height="${n(h)}" preserveAspectRatio="${item.imageFit === "cover" ? "xMidYMid slice" : "xMidYMid meet"}"/></g>`;
    }
    if (!item.text) return "";
    const curved = item.curved && item.place !== "center";
    const size = Math.max(10.2, Math.min(item.size * 1.7, (curved ? 300 : 400) / Math.max(item.text.length * .6, 1)));
    const ink = item.color || design.color;
    const run = glyphs(item.bold ? bold : regular, item.text, size, item.letterSpacing * 1.4);
    let pen = 0, out = "";
    if (curved) {
      const path = curve(item.place === "top" ? arcs.top : arcs.bottom), start = path.total / 2 - run.width / 2;
      for (const g of run.list) {
        const glyphAdv = g.adv - item.letterSpacing * 1.4, p = path.at(start + pen + glyphAdv / 2);
        if (g.inner) out += `<g transform="translate(${n(p.x)} ${n(p.y)}) rotate(${n(p.angle)}) translate(${n(-glyphAdv / 2)} 0)">${g.inner}</g>`;
        pen += g.adv;
      }
    } else {
      const x0 = 250 - run.width / 2, baseline = y + run.cap / 2;
      for (const g of run.list) {
        if (g.inner) out += `<g transform="translate(${n(x0 + pen)} ${n(baseline)})">${g.inner}</g>`;
        pen += g.adv;
      }
    }
    return `<g transform="${move}" fill="${ink}" color="${ink}">${out}</g>`;
  }).join("");
  const rings = `<g fill="none" stroke="${design.color}" stroke-width="${design.border}"${dash ? ` stroke-dasharray="${dash}"` : ""}>${shape(design.shape, 0)}${design.borderStyle !== "Plain" ? `<g opacity=".85">${shape(design.shape, 11)}</g>` : ""}${design.borderStyle.includes("triple") ? `<g opacity=".65">${shape(design.shape, 19)}</g>` : ""}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 500"><g opacity="${1 - design.aging * .004}">${rings}${body}</g></svg>`;
}
