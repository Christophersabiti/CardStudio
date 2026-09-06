import { timingSafeEqual } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/server";
import { reconcilePayment } from "@/lib/billing/pesapal";
import { jsonResponse } from "@/lib/http";
export async function POST(req: Request) {
  const secret = process.env.BILLING_JOB_SECRET;
  const incoming = req.headers.get("authorization") || "";
  const expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(incoming) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(incoming), Buffer.from(expected))
  )
    return jsonResponse({ error: "Unauthorized" }, 401);
  const c = createAdminClient();
  const { data: payments, error } = await c
    .from("payments")
    .select("order_id,provider_tracking_id")
    .eq("provider", "pesapal")
    .not("provider_tracking_id", "is", null)
    .in("status", ["pending", "completed"])
    .order("updated_at", { ascending: true })
    .limit(5);
  if (error) return jsonResponse({ error: "Queue unavailable" }, 503);
  let verified = 0,
    failed = 0;
  for (const p of payments) {
    try {
      await reconcilePayment(p.provider_tracking_id, p.order_id);
      verified++;
    } catch {
      failed++;
      await c
        .from("payments")
        .update({ updated_at: new Date().toISOString() })
        .eq("order_id", p.order_id);
    }
  }
  const maintenance = await c.rpc("commercial_maintenance");
  return jsonResponse(
    { verified, failed, maintenance: maintenance.data },
    maintenance.error ? 503 : 200,
  );
}

export const maxDuration = 300;

// Vercel's scheduler supplies the same configured secret in Authorization.
export const GET = POST;
