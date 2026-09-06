import { UserProfile } from "@clerk/nextjs";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth/session";

export default async function AccountPage() {
  if (!await currentUser()) redirect("/sign-in?next=/dashboard/account");
  return <><Header brand={activeBrand}/><main className="px-5 pb-12 flex flex-col items-center gap-5">
    <h1 className="text-2xl font-bold">Your account</h1>
    <UserProfile routing="path" path="/dashboard/account"/>
  </main></>;
}
