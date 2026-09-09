import type { CardRecord } from "../types";
import { samePublishedContent } from "../publication";
import { buildVcard } from "../vcard";

export const hasPrintPackage = (code: unknown): boolean => code === "basic" || code === "premium";
export type PrintPreset = "exact" | "bleed";
export class PrintError extends Error {
  constructor(message: string, public status = 422) { super(message); }
}
export function printSnapshot(record: CardRecord, revision: number, siteUrl?: string) {
  if (record.deleted_at) throw new PrintError("Restore this card before downloading.", 409);
  if (record.revision !== revision) throw new PrintError("This card changed. Reload it before downloading.", 409);
  const data = record.data;
  const mode = data.qrMode || "dynamic";
  let payload: string;
  if (mode === "dynamic") {
    if (!record.published || !samePublishedContent(data, record.published_data))
      throw new PrintError("Publish the current card details before downloading an online QR.", 409);
    let origin: URL;
    try { origin = new URL(siteUrl || ""); } catch { throw new PrintError("The public site address is not configured.", 503); }
    if (origin.protocol !== "https:" || origin.username || origin.password || origin.port || origin.pathname !== "/" || origin.search || origin.hash || !origin.hostname.includes(".") || /(?:localhost|\.local|\.vercel\.app)$/.test(origin.hostname) || /^[\d.]+$/.test(origin.hostname))
      throw new PrintError("Configure a canonical HTTPS domain before printing online QR codes.", 503);
    payload = `${origin.origin}/c/${record.slug}`;
  } else payload = buildVcard(data);
  return { data, mode, payload, revision: record.revision };
}
