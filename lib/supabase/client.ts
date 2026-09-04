import { createBrowserClient } from "@supabase/ssr";

/**
 * Browser Supabase client using the ANON key. Not used by the MVP (which keeps
 * all access server-side) — this is here so client-side auth drops in later
 * without restructuring. Safe to expose: the anon key is public.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
