import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "@/lib/http";
import { z } from "zod";
const schema = z.union([
  z.object({
    plan_id: z.uuid(),
    body: z.object({
      audience: z.string().max(200),
      description: z.string().max(600),
      display_order: z.number().int().min(0).max(100),
      recommended: z.boolean(),
      upgrade_codes: z.array(z.enum(["free", "basic", "premium"])).max(3),
      features: z.array(z.string().max(150)).max(12),
    }),
  }),
  z.object({
    plan_id: z.null(),
    body: z.object({ upgrade_threshold: z.number().int().min(1).max(100) }),
  }),
]);
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u || u.appRole !== "superadmin")
      throw new HttpError(403, "Superadmin required.");
    const b = schema.parse(await readJson(req, 8192));
    const r = await createAdminClient().rpc("update_plan_presentation", {
      actor: u.id,
      pid: b.plan_id,
      body: b.body,
    });
    if (r.error) throw r.error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
