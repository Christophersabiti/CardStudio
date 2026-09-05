import { createBrowserClient } from "@supabase/ssr";

/**
 * Public browser client. Table reads are owner-scoped by RLS; mutations use
 * the application's authenticated and validated server endpoints.
 */
export function createBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
