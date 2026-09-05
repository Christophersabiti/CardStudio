import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/session";
import { rateLimit, requestAddress } from "@/lib/rate-limit";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { safeNext } from "@/lib/validation";

export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await rateLimit(requestAddress(req), "password-ip", 30, 600);
    const body = z.object({email:z.email().max(254),password:z.string().min(1).max(1024),next:z.string().max(300).optional()}).strict().parse(await readJson(req,4096));
    const email = body.email.toLowerCase();
    await rateLimit(email, "password-email", 10, 600);
    const client = await createSessionClient();
    const {error} = await client.auth.signInWithPassword({email,password:body.password});
    if (error) throw new HttpError(error.status === 429 ? 429 : 401, error.status === 429 ? "Too many sign-in attempts. Please wait and try again." : "Email or password is incorrect.");
    return jsonResponse({ok:true,next:safeNext(body.next)});
  } catch(e) {return errorResponse(e);}
}
