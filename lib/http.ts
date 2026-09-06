import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(public status: number, message: string, public retryAfter?: number) { super(message); }
}
export async function readJson(req: Request, maxBytes = 1_200_000): Promise<unknown> {
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new HttpError(415, "Send JSON data.");
  const size = req.headers.get("content-length");
  if (size && Number(size) > maxBytes) throw new HttpError(413, "Request is too large. Use smaller images or fewer contacts.");
  if (!req.body) throw new HttpError(400, "Missing request data.");
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = []; let total = 0;
  try {
    while (true) {
      const {value, done} = await reader.read(); if (done) break;
      total += value.byteLength;
      if (total > maxBytes) { await reader.cancel(); throw new HttpError(413, "Request is too large. Use smaller images or fewer contacts."); }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", {fatal: true}).decode(Buffer.concat(chunks)));
  } catch(e) { if (e instanceof HttpError) throw e; throw new HttpError(400, "Invalid JSON data."); }
  finally { reader.releaseLock(); }
}
export function checkOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const allowed = new Set([new URL(req.url).origin]);
  if (process.env.NEXT_PUBLIC_SITE_URL) allowed.add(new URL(process.env.NEXT_PUBLIC_SITE_URL).origin);
  if (!origin || !allowed.has(origin) || req.headers.get("sec-fetch-site") === "cross-site") throw new HttpError(403, "Open Card Studio directly and try again.");
}
export const jsonResponse = (value: unknown, status = 200) => NextResponse.json(value, {status, headers: {"Cache-Control": "private, no-store"}});
export function errorResponse(e: unknown) {
  if (e instanceof ZodError) return jsonResponse({error: e.issues.map(i => `${i.path.join(".") || "Card"}: ${i.message}`).slice(0,3).join(" ")}, 400);
  if (e instanceof HttpError) {
    const res = jsonResponse({error: e.message}, e.status);
    if (e.retryAfter) res.headers.set("Retry-After", String(e.retryAfter));
    return res;
  }
  if (e && typeof e === "object" && "code" in e && e.code === "P0001") {
    return jsonResponse({error: "Your plan limit or account settings do not allow this action. Review Billing or contact support."},409);
  }
  // Never log request bodies, email addresses, tokens, or database error text.
  console.error("card_studio_request_failed", {type: e instanceof Error ? e.name : "UnknownError"});
  return jsonResponse({error: "We couldn't complete that request. Please try again."}, 503);
}
