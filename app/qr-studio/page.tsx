import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Builder from "@/components/qr-studio/Builder";
import { currentUser } from "@/lib/auth/session";
import { qrFeatures } from "@/lib/qr-studio/server";
import { activeBrand } from "@/lib/brand";
import "@/components/qr-studio/qr-studio.css";
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/qr-studio");
  if (!user.onboardingComplete && user.appRole !== "superadmin")
    redirect("/onboarding");
  return (
    <>
      <Header brand={activeBrand} />
      <main>
        <Builder ownerId={user.id} features={await qrFeatures(user.id)} />
      </main>
    </>
  );
}
