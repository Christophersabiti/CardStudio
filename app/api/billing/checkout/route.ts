import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { pesapalReady, submitOrder } from "@/lib/billing/pesapal";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (!user) throw new HttpError(401, "Sign in to continue.");
    await rateLimit(user.id, "checkout", 5, 60);
    if (!pesapalReady())
      throw new HttpError(503, "Checkout is not configured yet.");
    const b = z
      .object({ price_id: z.uuid(), request_id: z.uuid() })
      .strict()
      .parse(await readJson(req, 2048));
    const c = createAdminClient();
    const { data: o, error } = await c.rpc("create_checkout", {
      account_id: user.id,
      selected_price: b.price_id,
      request_key: b.request_id,
    });
    if (error) throw error;
    if (o.status !== "pending" || Date.parse(o.expires_at) < Date.now())
      throw new HttpError(
        409,
        "This checkout has expired. Start a new checkout.",
      );
    const { data: s } = await c
      .from("checkout_sessions")
      .select("redirect_url")
      .eq("order_id", o.id)
      .maybeSingle();
    if (s) return jsonResponse({ url: s.redirect_url });
    const { error: claim } = await c
      .from("checkout_dispatch")
      .insert({ order_id: o.id });
    if (claim)
      throw new HttpError(
        409,
        "This checkout is being processed. Return to Billing shortly. Do not pay a second time.",
      );
    const result = await submitOrder(o, user.email);
    const { error: payment } = await c
      .from("payments")
      .update({ provider_tracking_id: result.tracking })
      .eq("order_id", o.id)
      .eq("provider", "pesapal");
    if (payment) throw payment;
    const { error: save } = await c
      .from("checkout_sessions")
      .insert({ order_id: o.id, redirect_url: result.redirect });
    if (save) throw save;
    return jsonResponse({ url: result.redirect });
  } catch (e) {
    return errorResponse(e);
  }
}
