import { NextResponse } from "next/server";

// Retired tokens/codes are deliberately discarded, never exchanged or forwarded.
export async function GET(req: Request) {
  return NextResponse.redirect(new URL("/sign-in?legacy=1", req.url));
}
