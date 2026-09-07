import { z } from "zod";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
} from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth/session";
import { publicOwnerActive } from "@/lib/public-access";
import { requireQrUser } from "@/lib/qr-studio/server";
import { finalizeAsset, QR_BUCKET } from "@/lib/qr-studio/assets";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const u = await requireQrUser();
    await rateLimit(u.id, "qr-finalize", 15);
    return jsonResponse({
      source: await finalizeAsset(z.uuid().parse((await params).id), u.id),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    checkOrigin(req);
    const u = await requireQrUser();
    const id = z.uuid().parse((await params).id);
    const c = createAdminClient();
    const r = await c
      .from("qr_assets")
      .update({ state: "cancelled" })
      .eq("id", id)
      .eq("owner_id", u.id)
      .eq("state", "pending");
    if (r.error) throw r.error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const id = z.uuid().parse((await params).id),
      c = createAdminClient();
    const r = await c
      .from("qr_assets")
      .select("*")
      .eq("id", id)
      .eq("state", "ready")
      .maybeSingle();
    if (r.error) throw r.error;
    const a = r.data;
    if (!a || !(await publicOwnerActive(a.owner_id)))
      throw new HttpError(404, "Media unavailable.");
    const publicRef = await c.rpc("qr_asset_is_public", { asset_id: id });
    if (publicRef.error) throw publicRef.error;
    if (!publicRef.data && (await currentUser())?.id !== a.owner_id)
      throw new HttpError(404, "Media unavailable.");
    if (a.kind === "image") {
      const file = await c.storage.from(QR_BUCKET).download(a.path);
      if (file.error || !file.data) throw Error("Image unavailable");
      return new Response(file.data, {
        headers: {
          "Content-Type": a.mime_type,
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff",
        },
      });
    }
    const signed = await c.storage.from(QR_BUCKET).createSignedUrl(a.path, 60);
    if (signed.error) throw signed.error;
    return new Response(null, {
      status: 307,
      headers: {
        Location: signed.data.signedUrl,
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
