import { redirect } from "next/navigation";
import { safeNext } from "@/lib/validation";

export default async function Login({searchParams}: {searchParams:Promise<{next?:string}>}) {
  const next = safeNext((await searchParams).next);
  redirect(`/sign-in?next=${encodeURIComponent(next)}`);
}
