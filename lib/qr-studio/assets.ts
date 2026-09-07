import "server-only";
import sharp from "sharp";
import { createAdminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import { inspectMp4 } from "./mp4";
export const QR_BUCKET = "qr-studio-private";
export async function finalizeAsset(id: string, owner: string) {
  const c = createAdminClient();
  const r = await c
    .from("qr_assets")
    .select("*")
    .eq("id", id)
    .eq("owner_id", owner)
    .single();
  if (r.error || !r.data) throw new HttpError(404, "Upload not found.");
  const a = r.data;
  if (a.state === "ready") return `/api/qr-assets/${id}`;
  if (a.state !== "pending" || Date.parse(a.expires_at) < Date.now())
    throw new HttpError(409, "Upload expired. Upload the file again.");
  const file = await c.storage.from(a.upload_bucket).download(a.upload_path);
  if (file.error || !file.data)
    throw new HttpError(409, "Upload has not finished. Retry after uploading.");
  try {
    if (file.data.size > a.expected_bytes || file.data.size < 1)
      throw Error("File exceeds its reserved size");
    let bytes = Buffer.from(await file.data.arrayBuffer());
    let mime = "video/mp4",
      width = null,
      height = null,
      duration = null;
    if (a.kind === "image") {
      const img = sharp(bytes, {
        limitInputPixels: 40000000,
        failOn: "warning",
      });
      const meta = await img.metadata();
      if (
        !["png", "jpeg", "webp"].includes(meta.format || "") ||
        (meta.pages || 1) > 1
      )
        throw Error("Choose a PNG, JPEG or WebP image");
      const output = await img
        .rotate()
        .webp({ quality: 90 })
        .toBuffer({ resolveWithObject: true });
      bytes = Buffer.from(output.data);
      mime = "image/webp";
      width = output.info.width;
      height = output.info.height;
    } else {
      duration = inspectMp4(bytes).duration;
    }
    // Ready files use a different immutable path than the upload token's target.
    const path = `${owner}/ready/${id}-${crypto.randomUUID()}`;
    if (a.kind === "image" && bytes.length > 10000000)
      throw Error("The processed image is too large. Choose a smaller image.");
    const claim = await c
      .from("qr_assets")
      .update({
        state: "processing",
        path,
        size_bytes: a.reserved_bytes + bytes.length,
        stored_bytes: bytes.length,
      })
      .eq("id", id)
      .eq("owner_id", owner)
      .eq("state", "pending")
      .select("id")
      .maybeSingle();
    if (claim.error) throw claim.error;
    if (!claim.data)
      throw Error("This upload is already being processed. Try again shortly.");
    const stored = await c.storage
      .from(QR_BUCKET)
      .upload(path, bytes, { contentType: mime, upsert: false });
    if (stored.error)
      throw Error(
        "Could not store validated file. Upload it again; temporary space will be released after expiry.",
      );
    const result = await c
      .from("qr_assets")
      .update({
        path,
        mime_type: mime,
        size_bytes: bytes.length + a.reserved_bytes,
        stored_bytes: bytes.length,
        state: "ready",
        width,
        height,
        duration,
      })
      .eq("id", id)
      .eq("owner_id", owner)
      .eq("state", "processing")
      .select("id")
      .maybeSingle();
    if (result.error || !result.data) {
      await c.storage.from(QR_BUCKET).remove([path]);
      if (result.error) throw result.error;
      throw Error("Upload changed while processing. Try again.");
    }
    await c.storage.from(a.upload_bucket).remove([a.upload_path]);
    return `/api/qr-assets/${id}`;
  } catch (e) {
    if (e && typeof e === "object" && "code" in e && e.code === "P0001")
      throw e;
    throw new HttpError(
      400,
      e instanceof Error ? e.message : "This file could not be validated.",
    );
  }
}
