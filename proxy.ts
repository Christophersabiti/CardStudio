import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { authorizedParties, isClerkConfigured } from "@/lib/auth/config";

const privatePage = createRouteMatcher(["/dashboard(.*)", "/edit(.*)", "/admin(.*)", "/billing(.*)"]);
const privateApi = createRouteMatcher(["/api/cards(.*)", "/api/groups(.*)", "/api/uploads(.*)", "/api/account(.*)", "/api/billing/checkout", "/api/billing/trial", "/api/admin(.*)"]);
const clerk = clerkMiddleware(async (identity, request) => {
  const { userId } = await identity();
  if (!userId && privateApi(request)) {
    return NextResponse.json({ error: "Sign in to access your account." }, { status: 401 });
  }
  if (!userId && privatePage(request)) {
    const target = new URL("/sign-in", request.url);
    target.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(target);
  }
  const response = NextResponse.next();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}, () => ({ authorizedParties: authorizedParties() }));

export default function proxy(request: NextRequest, event: NextFetchEvent) {
  // Missing setup never authenticates a visitor or accepts an old cookie.
  if (!isClerkConfigured()) {
    if (privateApi(request)) return NextResponse.json({ error: "Account sign-in is not configured yet." }, { status: 503 });
    if (privatePage(request)) return NextResponse.redirect(new URL("/sign-in", request.url));
    return NextResponse.next();
  }
  return clerk(request, event);
}

export const config = { matcher: [
  "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
  "/(api|trpc)(.*)",
] };
