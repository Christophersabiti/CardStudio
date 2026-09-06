import {cookies} from "next/headers";
import { redirect } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import Header from "@/components/Header";
import AuthSetupNotice from "@/components/AuthSetupNotice";
import { activeBrand } from "@/lib/brand";
import { isClerkConfigured } from "@/lib/auth/config";

export const dynamic = "force-dynamic";
export default async function SignUpPage({searchParams}:{searchParams:Promise<{plan?:string}>}) {
  const plan=(await searchParams).plan || (await cookies()).get("card_studio_plan_intent")?.value;
  if(!plan)redirect("/pricing");
  const destination="/onboarding?plan="+encodeURIComponent(plan);
  return <><Header brand={activeBrand}/><main className="px-5 pb-12 flex justify-center">
    {isClerkConfigured() ? <SignUp routing="path" path="/sign-up" signInUrl="/sign-in"
      forceRedirectUrl={destination}/> : <AuthSetupNotice/>}
  </main></>;
}
