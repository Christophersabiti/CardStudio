import { NextResponse } from "next/server";
import { createSessionClient } from "@/lib/supabase/session";
import { safeNext } from "@/lib/validation";
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (code) {
    const {error} = await (await createSessionClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(safeNext(url.searchParams.get("next")),url.origin));
  }
  return NextResponse.redirect(new URL("/login?error=expired",url.origin));
}
