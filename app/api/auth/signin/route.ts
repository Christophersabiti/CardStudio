import { jsonResponse } from "@/lib/http";

// Retired: never exchange credentials or issue a legacy Supabase session.
export async function POST() {
  return jsonResponse({ error: "This sign-in method has moved. Use /sign-in.", signInUrl: "/sign-in" }, 410);
}
