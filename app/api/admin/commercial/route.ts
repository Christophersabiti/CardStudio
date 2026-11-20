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
import { adminActionSchema } from "@/lib/billing/validation";
import { rateLimit } from "@/lib/rate-limit";
/** Plain-language refusals raised by the admin database functions; anything else stays generic. */
const adminMessages = [
  "Choose between 1 and 24 months",
  "Enter the payment reference",
  "Account unavailable",
  "Choose a current Basic or Premium plan",
  "Subscription unavailable",
  "Grant unavailable or already revoked",
  "Give a reason (5 to 300 characters)",
  "You cannot change your own access here",
  "Keep an active superadmin",
  "Unknown feature",
];
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u || !isSuperAdministrator(u))
      throw new HttpError(403, "Superadmin access required.");
    await rateLimit(u.id, "admin-config", 30, 60);
    const b = adminActionSchema.parse(await readJson(req, 8192));
    const c = createAdminClient();
    // The actor is always the verified session user; every database function re-checks superadmin status.
    const { error } =
      b.action === "grant_plan"
        ? await c.rpc("admin_grant_plan", {
            actor: u.id,
            target: b.target,
            selected_plan: b.body.plan_id,
            months: b.body.months,
            reference: b.body.reference,
            note: b.body.note,
            amount: b.body.amount_minor,
            amount_currency: b.body.currency,
          })
        : b.action === "revoke_grant"
          ? await c.rpc("admin_revoke_grant", { actor: u.id, grant_id: b.target, reason: b.body.reason })
          : b.action === "feature"
            ? await c.rpc("admin_set_feature", { actor: u.id, feature: b.body.key, is_enabled: b.body.enabled })
            : await c.rpc("admin_commercial_update", {
                actor: u.id,
                action: b.action,
                target: "target" in b ? b.target : null,
                body: b.body,
              });
    if (error && adminMessages.includes(error.message)) throw new HttpError(400, error.message);
    if (error) throw error;
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
