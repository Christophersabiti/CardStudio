import { SignUp } from "@clerk/nextjs";
import Header from "@/components/Header";
import AuthSetupNotice from "@/components/AuthSetupNotice";
import { activeBrand } from "@/lib/brand";
import { isClerkConfigured } from "@/lib/auth/config";

export const dynamic = "force-dynamic";
export default function SignUpPage() {
  return <><Header brand={activeBrand}/><main className="px-5 pb-12 flex justify-center">
    {isClerkConfigured() ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in"
      forceRedirectUrl="/dashboard"/> : <AuthSetupNotice/>}
  </main></>;
}
