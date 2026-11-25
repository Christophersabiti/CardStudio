"use client";
import type { Design as StampDesign } from "@/components/marketing/StampMaker";
import type { AssetItem } from "@/lib/assets-schema";
import { saveCardAsPng } from "@/lib/captureCard";
import { downloadBlob } from "@/lib/download";
import { emptySignature, signatureHtml, type SignatureData } from "@/lib/email-signature";
import { emptyCard, type CardData, type GroupData } from "@/lib/types";
import { buildGroupVcard, buildVcard, contactFileBase, groupFileBase } from "@/lib/vcard";

export interface DownloadOption { key: string; label: string; note?: string }

/** Formats offered per product. Server-rendered files go through the product's own endpoint and plan rules. */
export function downloadOptions(a: AssetItem): DownloadOption[] | { blocked: string } {
  switch (a.kind) {
    case "card": return [{ key: "png", label: "Card image (PNG)" }, { key: "vcf", label: "Contact file (.vcf)", note: "From the saved draft." }];
    case "group": return [{ key: "vcf", label: "All contacts (.vcf)" }];
    case "qr": return a.published && !a.archived ? [{ key: "png", label: "PNG" }, { key: "svg", label: "SVG", note: "If your plan includes SVG." }] : { blocked: a.archived ? "Unarchive this QR code in QR Studio to download it." : "Publish this QR code in QR Studio to download it." };
    case "stamp": return [{ key: "png", label: "Transparent PNG · 1500 px", note: "Counts toward your monthly stamps." }];
    case "signature": return [{ key: "copy", label: "Copy for Gmail or Outlook" }, { key: "html", label: "HTML file" }];
    case "print": return [{ key: "zip", label: "Print package (ZIP)", note: "A stamp in the package counts toward your monthly stamps." }];
  }
}

const fileBase = (name: string) => name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").slice(0, 80).toLowerCase() || "design";
async function fail(r: Response, fallback: string): Promise<never> {
  let message = fallback;
  try { message = (await r.json()).error || fallback; } catch { /* non-JSON error */ }
  throw new Error(message);
}

/** `stage` holds the rendered preview; card images are captured from exactly what is shown. */
export async function downloadAsset(a: AssetItem, format: string, stage: HTMLElement | null): Promise<string> {
  if (a.kind === "card") {
    const data = { ...emptyCard(), ...(a.data as Partial<CardData>) } as CardData;
    if (format === "vcf") { downloadBlob(`${contactFileBase(data)}.vcf`, new Blob([buildVcard(data)], { type: "text/vcard" })); return "Contact file downloaded."; }
    await saveCardAsPng(stage?.querySelector<HTMLElement>(".cs-card") ?? null, `${contactFileBase(data)}-card.png`);
    return "Card image downloaded.";
  }
  if (a.kind === "group") {
    const data = a.data as unknown as GroupData;
    downloadBlob(`${groupFileBase(data)}.vcf`, new Blob([buildGroupVcard(data)], { type: "text/vcard" }));
    return "Contacts downloaded.";
  }
  if (a.kind === "qr") {
    const r = await fetch(`/api/qr-codes/${a.slug}/export?format=${format === "svg" ? "svg" : "png"}`);
    if (!r.ok) await fail(r, "Could not download this QR code.");
    downloadBlob(`${fileBase(a.name)}-qr.${format === "svg" ? "svg" : "png"}`, await r.blob());
    return "QR code downloaded.";
  }
  if (a.kind === "stamp") {
    const r = await fetch("/api/stamps/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: crypto.randomUUID(), design_id: a.id, design: a.data as unknown as StampDesign }) });
    if (!r.ok) await fail(r, "Could not generate this stamp.");
    downloadBlob(`${fileBase(a.name)}.png`, await r.blob());
    window.dispatchEvent(new Event("card-studio-usage"));
    return "Transparent PNG downloaded.";
  }
  if (a.kind === "signature") {
    const html = signatureHtml({ ...emptySignature, ...(a.data as Partial<SignatureData>) }, window.location.origin);
    if (format === "html") { downloadBlob(`${fileBase(a.name)}.html`, new Blob([`<!doctype html><html><head><meta charset="utf-8"><title>Email signature</title></head><body>${html}</body></html>`], { type: "text/html" })); return "HTML file downloaded."; }
    if (!navigator.clipboard?.write || typeof ClipboardItem === "undefined") throw new Error("Copying is unavailable in this browser. Download the HTML file instead.");
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([String((a.data as Partial<SignatureData>).name || a.name)], { type: "text/plain" }) })]);
    return "Signature copied. Paste it into your email app’s signature settings.";
  }
  const r = await fetch(`/api/print-packages/${a.id}/download`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: crypto.randomUUID() }) });
  if (!r.ok) await fail(r, "Could not prepare this print package.");
  downloadBlob(`${fileBase(a.name)}.zip`, await r.blob());
  window.dispatchEvent(new Event("card-studio-usage"));
  return "Print package downloaded.";
}
