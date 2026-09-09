import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { createAdminClient } from "../supabase/server";
import { mediaPath } from "../validation";
import { PrintError } from "./policy";

export async function ownedPrintImage(value: string, ownerId: string): Promise<Buffer | undefined> {
  if (!value) return;
  if (!mediaPath.test(value)) throw new PrintError("Save the card's uploaded images before printing.");
  const client = createAdminClient();
  const { data, error } = await client.from("card_studio_media").select("path").eq("id", value.split("/").pop()).eq("owner_id", ownerId).maybeSingle();
  if (error) throw error;
  if (!data) throw new PrintError("A card image is unavailable. Upload it again.");
  const result = await client.storage.from("card-studio-private").download(data.path);
  if (result.error || !result.data) throw new PrintError("A card image could not be loaded. Try again.", 503);
  return Buffer.from(await result.data.arrayBuffer());
}
export async function brandPrintImage(logo: string) {
  // Brand assets are developer-owned local files, never arbitrary URLs.
  if (!logo) return;
  if (!/^\/brands\/[a-zA-Z0-9_-]+\.(png|webp|jpg)$/.test(logo)) throw new PrintError("The brand logo is not available for printing.");
  return readFile(path.join(process.cwd(), "public", logo));
}
