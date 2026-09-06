import { z } from "zod";
import { NextRequest } from "next/server";

const userEvent = z.object({
  type: z.enum(["user.created","user.updated","user.deleted"]),
  timestamp: z.number().int().nonnegative().safe().optional(),
  data: z.object({
    id: z.string().regex(/^user_[A-Za-z0-9]+$/),
    first_name: z.string().nullable().optional(),
    last_name: z.string().nullable().optional(),
    banned: z.boolean().optional(),
    locked: z.boolean().optional(),
    updated_at: z.number().int().nonnegative().safe().optional(),
  }),
});

/** Call only AFTER the SDK verifies the raw request signature. No profile
 * metadata may supply role, owner_id, plan or account-link decisions.
 */
export function clerkEventArguments(verifiedEvent: unknown, eventId: string, signedTimestamp?: string | null) {
  const event = userEvent.parse(verifiedEvent);
  const eventAt = event.timestamp ?? event.data.updated_at ?? (signedTimestamp ? Number(signedTimestamp) * 1000 : NaN);
  return {
    event_id: z.string().min(1).max(200).parse(eventId),
    verified_clerk_id: event.data.id,
    event_type: event.type,
    event_at: z.number().int().nonnegative().safe().parse(eventAt),
    display_name: [event.data.first_name,event.data.last_name].filter(Boolean).join(" ").slice(0,200),
    // Temporary locks expire without a guaranteed user.updated event.
    // Enforce those through the live Clerk check on each application request.
    provider_disabled: !!event.data.banned,
  };
}

export async function boundedWebhookRequest(request: Request, limit = 128_000) {
  if (!request.body) throw new Error("Missing webhook body");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done,value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new Error("Webhook too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new NextRequest(request.url,{method:"POST",headers:request.headers,body:Buffer.concat(chunks)});
}
