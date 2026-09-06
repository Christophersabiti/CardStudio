import { auth, clerkClient } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { checkOrigin, errorResponse } from "@/lib/http";
import { isClerkConfigured } from "@/lib/auth/config";

// Compatibility for an older open tab. New UI uses Clerk's SignOutButton.
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    if (isClerkConfigured()) {
      const { sessionId } = await auth();
      if (sessionId) await (await clerkClient()).sessions.revokeSession(sessionId);
    }
    return NextResponse.redirect(new URL("/sign-in", req.url),303);
  } catch (e) { return errorResponse(e); }
}
