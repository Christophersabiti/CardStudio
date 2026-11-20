import { NextResponse } from "next/server";
import { featureFlags } from "@/lib/features";

/** Public product switches for the menu. Contains no account data, so it may be cached briefly. */
export async function GET() {
  return NextResponse.json(await featureFlags(), {
    headers: { "Cache-Control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" },
  });
}
