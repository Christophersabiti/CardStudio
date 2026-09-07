import { z } from "zod";
import { checkOrigin, errorResponse, jsonResponse, readJson } from "@/lib/http";
import { requireQrUser } from "@/lib/qr-studio/server";
import { createAdminClient } from "@/lib/supabase/server";
import { rateLimit } from "@/lib/rate-limit";

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireQrUser();
    await rateLimit(user.id, "qr-upload", 15);
    const body = z
      .object({
        kind: z.enum(["image", "video"]),
        size: z.number().int().positive().max(50000000),
      })
      .strict()
      .refine(
        (v) => v.kind === "video" || v.size <= 10000000,
        "Images must be 10 MB or less.",
      )
      .parse(await readJson(req, 1000));
    const c = createAdminClient();
    const tier = [1, 5, 10, 50].find((n) => body.size <= n * 1000000)!;
    const bucket = `qr-upload-${tier}`;
    const id = crypto.randomUUID(),
      path = `${user.id}/incoming/${id}`;
    const result = await c
      .from("qr_assets")
      .insert({
        id,
        owner_id: user.id,
        kind: body.kind,
        size_bytes: tier * 1000000,
        reserved_bytes: tier * 1000000,
        expected_bytes: body.size,
        upload_bucket: bucket,
        upload_path: path,
      })
      .select("id")
      .single();
    if (result.error) throw result.error;
    const signed = await c.storage.from(bucket).createSignedUploadUrl(path);
    if (signed.error) {
      await c.from("qr_assets").delete().eq("id", id).eq("owner_id", user.id);
      throw signed.error;
    }
    return jsonResponse({ id, uploadUrl: signed.data.signedUrl });
  } catch (e) {
    return errorResponse(e);
  }
}
