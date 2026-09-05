import "server-only";
import { createHmac } from "node:crypto";
import { createAdminClient } from "./supabase/server";
import { HttpError } from "./http";

// Durable and atomic across serverless instances. Only a server-keyed hash is stored.
export async function rateLimit(subject: string, scope: string, limit: number, seconds = 60) {
  const key = createHmac("sha256", process.env.SUPABASE_SERVICE_ROLE_KEY!).update(`${scope}:${subject}`).digest("hex");
  const {data, error} = await createAdminClient().rpc("consume_card_studio_limit", {bucket_key: key, max_requests: limit, window_seconds: seconds});
  if (error) throw new Error("Rate limit unavailable"); // Fail closed.
  if (!data) throw new HttpError(429, "Too many requests. Please wait and try again.", seconds);
}
export function requestAddress(req: Request) {
  // Vercel overwrites this header. Never trust arbitrary x-forwarded-for on other hosts.
  return process.env.VERCEL ? (req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() || "unknown") : "local-or-self-hosted";
}
