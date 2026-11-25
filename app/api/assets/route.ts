import { requireUser } from "@/lib/auth/session";
import { listAssets } from "@/lib/assets";
import { assetListSchema } from "@/lib/assets-schema";
import { errorResponse, jsonResponse } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
/** Owner-scoped "My designs" listing across every product. */
export async function GET(req: Request) {
  try {
    const user = await requireUser("Sign in to see your designs.");
    await rateLimit(user.id, "asset-list", 120);
    const params = assetListSchema.parse(Object.fromEntries(new URL(req.url).searchParams));
    return jsonResponse(await listAssets(user.id, params));
  } catch (e) { return errorResponse(e); }
}
