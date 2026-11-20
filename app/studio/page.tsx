import UsageBanner from "@/components/UsageBanner";
import {redirect} from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import Studio from "@/components/Studio";
import { activeBrand } from "@/lib/brand";
import { currentUser, needsOnboarding } from "@/lib/auth/session";

export default async function Home({searchParams}:{searchParams:Promise<{mode?:string}>}) {
  const user = await currentUser();
  if(user&&needsOnboarding(user))redirect("/onboarding");
  const mode = (await searchParams).mode;
  return (
    <>
      <SiteHeader />
      {user&&<div className="max-w-6xl mx-auto px-5"><UsageBanner/></div>}
      <Studio brand={activeBrand} userId={user?.id || null} initialKind={mode === "groups" ? "groups" : "cards"} />
    </>
  );
}
