import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { catalog } from "@/lib/billing/catalog";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "@/lib/http";
import { z } from "zod";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u) throw new HttpError(401, "Sign in.");
    const b = z
      .object({ plan: z.literal("free") })
      .parse(await readJson(req, 1024));
    const cat = await catalog();
    if (!cat.plans.some((p) => p.code === b.plan))
      throw new HttpError(409, "This plan is unavailable.");
    const r = await createAdminClient()
      .from("users")
      .update({ onboarding_complete: true })
      .eq("id", u.id);
    if (r.error) throw r.error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
