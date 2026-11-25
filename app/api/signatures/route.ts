import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { requireFeature } from "@/lib/features";
import { getLibraryDesign, saveLibraryDesign, touchAsset } from "@/lib/assets";
import { signatureSaveSchema } from "@/lib/assets-schema";
import { checkOrigin, errorResponse, jsonResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
/** GET ?id= loads one of the owner's saved signatures. */
export async function GET(req: Request) {
  try {
    const user = await requireUser("Sign in to open saved signatures.");
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    const design = await getLibraryDesign(user.id, "signature", id);
    await touchAsset(user.id, "signature", id);
    return jsonResponse({ design });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireUser("Sign in to save your signature to My designs.");
    await requireFeature("email_signature");
    await rateLimit(user.id, "signature-save", 30);
    const body = signatureSaveSchema.parse(await readJson(req, 64_000));
    const result = await saveLibraryDesign(user.id, "signature", { id: body.id, revision: body.revision, name: body.name, content: body.design });
    return jsonResponse({ design: result.design }, result.created ? 201 : 200);
  } catch (e) { return errorResponse(e); }
}
