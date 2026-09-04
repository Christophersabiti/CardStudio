import { toPng } from "html-to-image";
import { downloadBlob, dataUrlToBlob } from "./download";

/**
 * Rasterize a rendered card node (matched by CSS selector) to PNG and download
 * it. Used for both the single-card and group-card "Save Digital Card" actions.
 * html-to-image (not html2canvas) is required here because the card uses
 * color-mix() and CSS-variable gradients that html2canvas's own CSS parser
 * doesn't understand — html-to-image paints via an SVG foreignObject, so it
 * gets whatever the real browser renders.
 */
export async function saveCardAsPng(selector: string, filename: string): Promise<void> {
  const node = document.querySelector<HTMLElement>(selector);
  if (!node) throw new Error("Card preview not found");
  const dataUrl = await toPng(node, { pixelRatio: 2, cacheBust: true });
  downloadBlob(filename, dataUrlToBlob(dataUrl));
}
