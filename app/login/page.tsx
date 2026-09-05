import Header from "@/components/Header";
import LoginForm from "@/components/LoginForm";
import { activeBrand } from "@/lib/brand";
import { safeNext } from "@/lib/validation";
import { currentUser } from "@/lib/supabase/session";
import { redirect } from "next/navigation";
export default async function Login({searchParams}: {searchParams:Promise<{next?:string;error?:string}>}) {
  const params = await searchParams;
  const next = safeNext(params.next);
  if(await currentUser())redirect(next);
  return <><Header brand={activeBrand}/><main className="max-w-lg mx-auto px-5 pb-12"><LoginForm next={next} expired={!!params.error}/></main></>;
}
