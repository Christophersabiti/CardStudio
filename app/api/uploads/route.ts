import { z } from "zod";
import { currentUser } from "@/lib/supabase/session";
import { storeImage } from "@/lib/media";
import { rateLimit } from "@/lib/rate-limit";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
export const runtime = "nodejs";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (!user) throw new HttpError(401,"Sign in to upload images.");
    await rateLimit(user.id,"upload",15);
    const {image} = z.object({image:z.string().max(550_000)}).strict().parse(await readJson(req,560_000));
    return jsonResponse({url:await storeImage(image,user.id)});
  } catch(e) {return errorResponse(e);}
}
