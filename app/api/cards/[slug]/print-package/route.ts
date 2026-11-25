import { requireFeature } from "@/lib/features";
import { z } from "zod";
import { requireUser } from "@/lib/auth/session";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { PrintError } from "@/lib/print-package/policy";
import { PrintPlanRequired } from "@/lib/print-package/service";
import { cardPrintZip } from "@/lib/print-package/card";

export const runtime = "nodejs";
export const maxDuration = 60;
const requestSchema = z.object({revision:z.number().int().nonnegative(),preset:z.enum(["exact","bleed"]).default("exact")}).strict();
export async function POST(req: Request, {params}: {params: Promise<{slug:string}>}) {
  try {
    checkOrigin(req);
    const user = await requireUser("Sign in to download a print package.");
    await requireFeature("print_package");
    await rateLimit(user.id,"print-package",6);
    const {slug} = await params;
    const raw = await readJson(req,2048);
    const body = requestSchema.parse(raw);
    const result = await cardPrintZip(user,slug,body.revision,body.preset);
    return new Response(new Uint8Array(result.zip),{headers:{
      "Content-Type":"application/zip",
      "Content-Disposition":`attachment; filename="card-${slug}-r${body.revision}-${result.mode === "dynamic" ? "online" : "offline"}.zip"`,
      "Cache-Control":"private, no-store", "X-Content-Type-Options":"nosniff",
    }});
  } catch(error) {
    if(error instanceof PrintPlanRequired) return jsonResponse({error:error.message,code:"plan_required"},403);
    if(error instanceof PrintError) return errorResponse(new HttpError(error.status,error.message));
    return errorResponse(error);
  }
}
