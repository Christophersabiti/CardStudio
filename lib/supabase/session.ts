import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createSessionClient() {
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () => jar.getAll(),
      setAll: values => { try { values.forEach(({name,value,options}) => jar.set(name,value,options)); } catch { /* Server component: proxy refreshes cookies. */ } },
    },
  });
}
export async function currentUser() {
  const client = await createSessionClient();
  const {data: {user}} = await client.auth.getUser();
  return user && !user.is_anonymous ? user : null;
}
