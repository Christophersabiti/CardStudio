import { z } from "zod";
import { createSessionClient } from "@/lib/supabase/session";
import { rateLimit, requestAddress } from "@/lib/rate-limit";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { safeNext } from "@/lib/validation";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    await rateLimit(requestAddress(req),"signin-ip",10,600);
    const body = z.object({email:z.email().max(254),next:z.string().max(300).optional()}).strict().parse(await readJson(req,2048));
    await rateLimit(body.email.toLowerCase(),"signin-email",3,600);
    const base = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
    const redirect = new URL("/auth/callback",base);
    redirect.searchParams.set("next",safeNext(body.next));
    const client = await createSessionClient();
    const {error} = await client.auth.signInWithOtp({email:body.email,options:{emailRedirectTo:redirect.toString()}});
    if (error) throw new HttpError(error.status === 429 ? 429 : 503,"The sign-in email could not be sent. Wait a moment and try again, or contact the site administrator.",60);
    return jsonResponse({ok:true});
  } catch(e) {return errorResponse(e);}
}
