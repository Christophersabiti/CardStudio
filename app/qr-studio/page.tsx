import { redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import Builder from "@/components/qr-studio/Builder";
import { currentUser, needsOnboarding } from "@/lib/auth/session";
import { qrFeatures } from "@/lib/qr-studio/server";
import "@/components/qr-studio/qr-studio.css";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/qr-studio");
  if (needsOnboarding(user))
    redirect("/onboarding");
  return (
    <>
      <SiteHeader />
      <main>
        <Builder ownerId={user.id} features={await qrFeatures(user.id)} />
      </main>
    </>
  );
}
