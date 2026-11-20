import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import Dashboard from "@/components/Dashboard";
import UsageBanner from "@/components/UsageBanner";
import DashboardWelcome, { type RecentQr } from "@/components/DashboardWelcome";
import { productFeature, products } from "@/lib/navigation";
import { featureFlags } from "@/lib/features";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser, needsOnboarding } from "@/lib/auth/session";
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
  if (!user) redirect("/sign-in?next=/dashboard");
  if (needsOnboarding(user)) redirect("/onboarding");
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
  const home = page === 1 && !query && !trash;
  const c = createAdminClient();
  const [flags, qr, stamps] = home
    ? await Promise.all([
        featureFlags(),
        c.from("qr_codes").select("slug,type,published,updated_at,data").eq("owner_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(3),
        c.from("stamp_designs").select("id,name,updated_at").eq("owner_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(3),
      ])
    : [null, null, null];
  const recentQr: RecentQr[] = (qr?.data || []).map((q) => ({ slug: q.slug, type: q.type, published: q.published, updated_at: q.updated_at, title: (q.data as { title?: string } | null)?.title || "" }));
  return (
    <>
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-5 pb-16">
        {home && flags && (
          <DashboardWelcome products={products.filter((p) => flags[productFeature[p.key]])} qr={recentQr} stamps={stamps?.data || []} />
        )}
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            {home ? <h2 className="text-2xl font-bold">My cards</h2> : <h1 className="text-3xl font-bold">My cards</h1>}
            <p className="cs-muted mt-2">Cards and team contacts you have saved.</p>
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
