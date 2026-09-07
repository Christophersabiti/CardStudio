import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Dashboard from "@/components/Dashboard";
import UsageBanner from "@/components/UsageBanner";
import { activeBrand } from "@/lib/brand";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth/session";
import { isAdministrator } from "@/lib/roles";
export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    trash?: string;
    view?: string;
  }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login?next=/dashboard");
  if (user.appRole!=="superadmin"&&!user.onboardingComplete) redirect("/onboarding");
  const params = await searchParams;
  const page = Math.max(1, Math.min(10000, parseInt(params.page || "1") || 1));
  const query = (params.q || "").trim().slice(0, 120);
  const trash = params.trash === "1";
  const r = await createAdminClient().rpc("search_owned_cards", {
    account_id: user.id,
    query: query.length >= 2 ? query : "",
    trash,
    page_number: page,
  });
  if (r.error) throw Error("Card search unavailable");
  return (
    <>
      <Header brand={activeBrand} />
      <main className="max-w-6xl mx-auto px-5 pb-16">
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">My cards</h1>
            <p className="cs-muted mt-2">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Link href="/dashboard/qr" className="cs-button">My QR codes</Link>
            {isAdministrator(user) && (
              <Link href="/admin" className="cs-button">
                Administration
              </Link>
            )}
            <Link href="/studio" className="cs-button cs-primary">
              Create card
            </Link>
            <Link href="/dashboard/account" className="cs-button">
              Account
            </Link>
          </div>
        </div>
        <UsageBanner />
        <Dashboard
          items={r.data.items}
          total={r.data.total}
          ownerId={user.id}
          query={query}
          trash={trash}
          page={page}
          initialView={params.view}
        />
      </main>
    </>
  );
}
