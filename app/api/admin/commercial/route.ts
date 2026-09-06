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
import { adminSchema } from "@/lib/billing/validation";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u || !isSuperAdministrator(u))
      throw new HttpError(403, "Superadmin access required.");
    await rateLimit(u.id, "admin-config", 30, 60);
    const b = adminSchema.parse(await readJson(req, 8192));
    const { error } = await createAdminClient().rpc("admin_commercial_update", {
      actor: u.id,
      action: b.action,
      target: "target" in b ? b.target : null,
      body: b.body,
    });
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
