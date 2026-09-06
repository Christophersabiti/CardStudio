import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "@/lib/http";
import { cardDraftSchema, groupDraftSchema } from "@/lib/validation";
import { z } from "zod";
const keySchema = z
  .string()
  .regex(/^(cards|groups):(new|[A-Za-z0-9_-]{6,40})$/);
export async function GET(req: Request) {
  try {
    const u = await currentUser();
    if (!u) throw new HttpError(401, "Sign in.");
    const key = keySchema.parse(new URL(req.url).searchParams.get("key"));
    const r = await createAdminClient()
      .from("draft_recovery")
      .select("snapshot")
      .eq("owner_id", u.id)
      .eq("draft_key", key)
      .maybeSingle();
    if (r.error) throw r.error;
    return jsonResponse({ snapshot: r.data?.snapshot || null });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u) throw new HttpError(401, "Sign in.");
    const b = z
      .object({
        key: keySchema,
        snapshot: z.object({
          data: z.unknown(),
          revision: z.number().int().optional(),
          requestId: z.string().uuid().optional(),
        }),
      })
      .parse(await readJson(req, 1500000));
    const schema = b.key.startsWith("cards:")
      ? cardDraftSchema
      : groupDraftSchema;
    b.snapshot.data = schema.parse(b.snapshot.data);
    const c = createAdminClient();
    const [kind, slug] = b.key.split(":");
    if (slug !== "new") {
      const record = await c
        .from(kind)
        .select("id")
        .eq("slug", slug)
        .eq("owner_id", u.id)
        .maybeSingle();
      if (record.error || !record.data)
        throw new HttpError(404, "Card unavailable.");
    }
    const r = await c
      .from("draft_recovery")
      .upsert({
        owner_id: u.id,
        draft_key: b.key,
        snapshot: b.snapshot,
        updated_at: new Date().toISOString(),
      });
    if (r.error) throw r.error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u) throw new HttpError(401, "Sign in.");
    const key = keySchema.parse(new URL(req.url).searchParams.get("key"));
    const r = await createAdminClient()
      .from("draft_recovery")
      .delete()
      .eq("owner_id", u.id)
      .eq("draft_key", key);
    if (r.error) throw r.error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
