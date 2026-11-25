import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { requireFeature } from "@/lib/features";
import { getLibraryDesign, saveLibraryDesign, touchAsset } from "@/lib/assets";
import { printSaveSchema } from "@/lib/assets-schema";
import { checkOrigin, errorResponse, jsonResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
export async function GET(req: Request) {
  try {
    const user = await requireUser("Sign in to open saved print packages.");
    const id = z.uuid().parse(new URL(req.url).searchParams.get("id"));
    const design = await getLibraryDesign(user.id, "print", id);
    await touchAsset(user.id, "print", id);
    return jsonResponse({ design });
  } catch (e) { return errorResponse(e); }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await requireUser("Sign in to save print packages.");
    await requireFeature("print_package");
    await rateLimit(user.id, "print-package-save", 30);
    const body = printSaveSchema.parse(await readJson(req, 8_000));
    const result = await saveLibraryDesign(user.id, "print", { id: body.id, revision: body.revision, name: body.name, content: body.config });
    return jsonResponse({ design: result.design }, result.created ? 201 : 200);
  } catch (e) { return errorResponse(e); }
}
