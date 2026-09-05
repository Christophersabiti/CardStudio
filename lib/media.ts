import "server-only";
import sharp from "sharp";
import { createHash } from "node:crypto";
import { createAdminClient } from "./supabase/server";
import { HttpError } from "./http";
import { mediaPath } from "./validation";

export async function storeImage(value: string, ownerId: string): Promise<string> {
  if (!value) return "";
  const client = createAdminClient();
  if (mediaPath.test(value)) {
    const {data, error} = await client.from("card_studio_media").select("id").eq("id",value.split("/").pop()).eq("owner_id",ownerId).maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(400,"That image is unavailable. Please upload it again.");
    return value;
  }
  if (!/^data:image\/(png|jpeg|webp);base64,/.test(value)) throw new HttpError(400,"Choose a PNG, JPEG or WebP image.");
  const raw = Buffer.from(value.split(",")[1],"base64");
  if (raw.length > 420_000) throw new HttpError(413,"Image is too large. Choose a smaller image.");
  let bytes: Buffer;
  try {
    const input = sharp(raw,{limitInputPixels: 20_000_000, failOn: "warning"});
    const meta = await input.metadata();
    if (!["jpeg","png","webp"].includes(meta.format || "") || (meta.pages || 1) > 1) throw new Error("Unsupported image");
    bytes = await input.rotate().resize(640,640,{fit:"inside",withoutEnlargement:true}).webp({quality:85}).toBuffer();
  } catch { throw new HttpError(400,"This image could not be read. Choose a different PNG, JPEG or WebP."); }
  const path = `${ownerId}/${createHash("sha256").update(bytes).digest("hex")}.webp`;
  const existing = await client.from("card_studio_media").select("id").eq("path",path).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data) return `/api/media/${existing.data.id}`;
  const upload = await client.storage.from("card-studio-private").upload(path,bytes,{contentType:"image/webp",upsert:true});
  if (upload.error) throw upload.error;
  const {data,error} = await client.from("card_studio_media").upsert({path,owner_id:ownerId},{onConflict:"path"}).select("id").single();
  if (error) throw error;
  return `/api/media/${data.id}`;
}
