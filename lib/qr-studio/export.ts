import "server-only";
import { HttpError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/server";
import { QR_BUCKET } from "./assets";
import { renderQr } from "./render";
import { qrFeatures } from "./server";
import type { QrRecord } from "./schema";

/**
 * Render a published dynamic QR for its verified owner, applying the owner's plan
 * features (logo, colour, SVG). Shared by the QR export route and print packages.
 */
export async function renderOwnedQr(ownerId: string, q: QrRecord | null, opts: { svg: boolean; card: boolean }) {
  if (!q?.published || q.deleted_at || q.archived_at || !q.published_data)
    throw new HttpError(409, "Publish this QR before exporting it.");
  const d = q.published_data;
  const f = await qrFeatures(ownerId);
  if (opts.svg && !f.svg) throw new HttpError(403, "SVG export is not included in your plan.");
  let logo: Buffer | undefined;
  if (d.logo && f.logo) {
    const c = createAdminClient(), id = d.logo.split("/").pop();
    const a = await c.from("qr_assets").select("path").eq("id", id).eq("owner_id", ownerId).eq("state", "ready").eq("kind", "image").single();
    if (a.error) throw a.error;
    const file = await c.storage.from(QR_BUCKET).download(a.data.path);
    if (file.error) throw file.error;
    logo = Buffer.from(await file.data.arrayBuffer());
  }
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new HttpError(503, "Configure the canonical site URL before exporting QR codes.");
  const output = await renderQr({ url: new URL(`/q/${q.slug}`, origin).toString(), color: f.colors ? d.color : "#202520", logo, title: d.title, fit: d.logoFit, caption: d.caption, card: opts.card });
  const base = d.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 60) || "event";
  return { output, filename: `${base}-qr.${opts.svg ? "svg" : "png"}` };
}
