import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { assetAction } from "@/lib/assets";
import { assetActionSchema, assetKinds } from "@/lib/assets-schema";
import { checkOrigin, errorResponse, jsonResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
const target = z.object({ kind: z.enum(assetKinds), id: z.uuid() });
/** Rename, favourite, record opening, and (stamps, signatures, print packages) Trash/restore/duplicate. */
export async function PATCH(req: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser("Sign in to manage your designs.");
    await rateLimit(user.id, "asset-action", 60);
    const { kind, id } = target.parse(await params);
    const body = assetActionSchema.parse(await readJson(req, 4096));
    return jsonResponse(await assetAction(user.id, kind, id, body));
  } catch (e) { return errorResponse(e); }
}
