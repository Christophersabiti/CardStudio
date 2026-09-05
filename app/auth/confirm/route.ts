import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
import { safeNext } from "@/lib/validation";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const token_hash = url.searchParams.get("token_hash");
  if (token_hash && url.searchParams.get("type") === "email") {
    const {error} = await (await createSessionClient()).auth.verifyOtp({token_hash,type:"email"});
    if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")),url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=expired",url.origin));
}
