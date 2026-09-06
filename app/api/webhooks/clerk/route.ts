import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createAdminClient } from "@/lib/supabase/server";
import { boundedWebhookRequest, clerkEventArguments } from "@/lib/auth/webhook";
import { jsonResponse } from "@/lib/http";

export const runtime = "nodejs";
export async function POST(req: Request) {
  const secret = process.env.CLERK_WEBHOOK_SIGNING_SECRET;
  if (!secret) return jsonResponse({error:"Webhook configuration unavailable."},503);
  let event;
  let args;
  try {
    event = await verifyWebhook(await boundedWebhookRequest(req),{signingSecret:secret});
    if (!["user.created","user.updated","user.deleted"].includes(event.type)) return jsonResponse({ok:true});
    args = clerkEventArguments(event,req.headers.get("svix-id") || "",req.headers.get("svix-timestamp"));
  } catch { return jsonResponse({error:"Invalid webhook."},400); }
  try {
    const {error} = await createAdminClient().rpc("sync_clerk_user_event",args);
    if (error) throw new Error("Webhook persistence unavailable");
    return jsonResponse({ok:true});
  } catch {
    // A non-2xx response triggers delivery retries. Never log payloads/secrets.
    return jsonResponse({error:"Webhook processing unavailable. Retry delivery."},503);
  }
}
