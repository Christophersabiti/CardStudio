import "server-only";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

export async function createSessionClient() {
  const identity = await auth();
  if (!identity.userId) throw new Error("Authenticated database session required.");
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key || !process.env.NEXT_PUBLIC_SUPABASE_URL) throw new Error("Supabase public configuration is missing.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, key, {
    accessToken: async () => identity.getToken(),
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
