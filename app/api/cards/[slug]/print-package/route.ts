import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { activeBrand } from "@/lib/brand";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { ownedRecord } from "@/lib/records";
import { rateLimit } from "@/lib/rate-limit";
import { cardSchema } from "@/lib/validation";
import type { CardData, CardRecord } from "@/lib/types";
import { printAccess } from "@/lib/print-package/access";
import { brandPrintImage, ownedPrintImage } from "@/lib/print-package/assets";
import { PrintError } from "@/lib/print-package/policy";
import { createPrintPackage, PrintPlanRequired } from "@/lib/print-package/service";
import { renderPrintPackage } from "@/lib/print-package/render";

export const runtime = "nodejs";
export const maxDuration = 60;
const requestSchema = z.object({revision:z.number().int().nonnegative(),preset:z.enum(["exact","bleed"]).default("exact")}).strict();
export async function POST(req: Request, {params}: {params: Promise<{slug:string}>}) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if(!user) throw new HttpError(401,"Sign in to download a print package.");
    await rateLimit(user.id,"print-package",6);
    const {slug} = await params;
    const raw = await readJson(req,2048);
    const body = requestSchema.parse(raw);
    const result = await createPrintPackage(user.id,slug,body.revision,body.preset,process.env.NEXT_PUBLIC_SITE_URL,{
      ownedRecord: async (cardSlug,ownerId) => {
        const record = await ownedRecord("cards",cardSlug,ownerId) as CardRecord | null;
        return record ? {...record,data:cardSchema.parse(record.data) as CardData} : null;
      },
      allowed: async () => (await printAccess(user)).allowed,
      render: async (snapshot,preset,ownerId) => {
        const [photo,logo] = await Promise.all([ownedPrintImage(snapshot.data.photo,ownerId),snapshot.data.logo ? ownedPrintImage(snapshot.data.logo,ownerId) : brandPrintImage(activeBrand.logo)]);
        return (await renderPrintPackage({...snapshot,brand:activeBrand,photo,logo,preset})).zip;
      },
    });
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
