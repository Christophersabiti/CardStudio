import { ownedQr, requireQrUser, qrFeatures } from "@/lib/qr-studio/server";
import { errorResponse, HttpError } from "@/lib/http";
import { renderQr } from "@/lib/qr-studio/render";
import { createAdminClient } from "@/lib/supabase/server";
import { QR_BUCKET } from "@/lib/qr-studio/assets";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireQrUser();
    await rateLimit(user.id, "qr-export", 30);
    const q = await ownedQr((await params).slug, user.id);
    if (!q?.published || q.deleted_at || q.archived_at || !q.published_data)
      throw new HttpError(409, "Publish this QR before exporting it.");
    const d = q.published_data;
    const f = await qrFeatures(user.id);
    const p = new URL(req.url).searchParams;
    const svg = p.get("format") === "svg";
    if (svg && !f.svg)
      throw new HttpError(403, "SVG export is not included in your plan.");
    let logo: Buffer | undefined;
    if (d.logo && f.logo) {
      const c = createAdminClient(),
        id = d.logo.split("/").pop();
      const a = await c
        .from("qr_assets")
        .select("path")
        .eq("id", id)
        .eq("owner_id", user.id)
        .eq("state", "ready")
        .eq("kind", "image")
        .single();
      if (a.error) throw a.error;
      const file = await c.storage.from(QR_BUCKET).download(a.data.path);
      if (file.error) throw file.error;
      logo = Buffer.from(await file.data.arrayBuffer());
    }
    const origin = process.env.NEXT_PUBLIC_SITE_URL;
    if (!origin)
      throw new HttpError(
        503,
        "Configure the canonical site URL before exporting QR codes.",
      );
    const output = await renderQr({
      url: new URL(`/q/${q.slug}`, origin).toString(),
      color: f.colors ? d.color : "#202520",
      logo,
      title: d.title,
      fit: d.logoFit,
      caption: d.caption,
      card: p.get("layout") !== "plain",
    });
    return new Response(svg ? output.svg : new Uint8Array(output.png), {
      headers: {
        "Content-Type": svg ? "image/svg+xml" : "image/png",
        "Content-Disposition": `${p.has("preview") ? "inline" : "attachment"}; filename="${
          d.title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .slice(0, 60) || "event"
        }-qr.${svg ? "svg" : "png"}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
