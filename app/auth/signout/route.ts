import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
import { checkOrigin, errorResponse } from "@/lib/http";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const {error} = await (await createSessionClient()).auth.signOut({scope:"local"});
    if (error) throw error;
    return NextResponse.redirect(new URL("/login",req.url),303);
  } catch(e) { return errorResponse(e); }
}
