import { SignIn } from "@clerk/nextjs";
import Header from "@/components/Header";
import AuthSetupNotice from "@/components/AuthSetupNotice";
import { activeBrand } from "@/lib/brand";
import { isClerkConfigured } from "@/lib/auth/config";
import { safeNext } from "@/lib/validation";

export const dynamic = "force-dynamic";
export default async function SignInPage({searchParams}: {searchParams:Promise<{next?:string;legacy?:string}>}) {
  const params = await searchParams;
  return <><Header brand={activeBrand}/><main className="px-5 pb-12 flex flex-col items-center gap-5">
    {params.legacy && <p role="status">Sign-in has changed. Please sign in again below.</p>}
    {isClerkConfigured() ? <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up"
      forceRedirectUrl={safeNext(params.next)}/> : <AuthSetupNotice/>}
  </main></>;
}
