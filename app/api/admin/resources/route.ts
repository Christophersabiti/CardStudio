import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { isSuperAdministrator } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u || !isSuperAdministrator(u))
      throw new HttpError(403, "Superadmin required.");
    await rateLimit(u.id, "admin-resource", 30);
    const b = z
      .object({
        kind: z.enum(["cards", "groups"]),
        id: z.uuid(),
        action: z.enum(["unpublish", "trash", "restore"]),
        reason: z.string().trim().min(5).max(300),
      })
      .strict()
      .parse(await readJson(req, 2048));
    const { error } = await createAdminClient().rpc("admin_resource_update", {
      actor: u.id,
      kind: b.kind,
      resource_id: b.id,
      operation: b.action,
      reason: b.reason,
    });
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
