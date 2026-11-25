import Link from "next/link";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import UsageBanner from "@/components/UsageBanner";
import DashboardWelcome, { type RecentQr } from "@/components/DashboardWelcome";
import RecentDesigns from "@/components/designs/RecentDesigns";
import { productFeature, products } from "@/lib/navigation";
import { featureFlags } from "@/lib/features";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser, needsOnboarding } from "@/lib/auth/session";
import { listAssets } from "@/lib/assets";
import { activeBrand } from "@/lib/brand";
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
  // The card list moved to My designs; keep old bookmarks and links working.
  if (params.q || params.trash === "1" || (params.page && params.page !== "1")) {
    const next = new URLSearchParams();
    if (params.q) next.set("q", params.q.slice(0, 120));
    if (params.trash === "1") next.set("section", "trash");
    redirect(`/designs${next.size ? `?${next}` : ""}`);
  }
  const c = createAdminClient();
  const [flags, qr, stamps, recent] = await Promise.all([
    featureFlags(),
    c.from("qr_codes").select("slug,type,published,updated_at,data").eq("owner_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(3),
    c.from("stamp_designs").select("id,name,updated_at").eq("owner_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(3),
    listAssets(user.id, { kind: "", q: "", section: "all", sort: "updated", page: 1 }),
  ]);
  const recentQr: RecentQr[] = (qr.data || []).map((q) => ({ slug: q.slug, type: q.type, published: q.published, updated_at: q.updated_at, title: (q.data as { title?: string } | null)?.title || "" }));
  return (
    <>
      <SiteHeader />
      <main className="max-w-6xl mx-auto px-5 pb-16">
        <DashboardWelcome products={products.filter((p) => flags[productFeature[p.key]])} qr={recentQr} stamps={stamps.data || []} />
        <div className="flex flex-wrap justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">Continue where you left off</h2>
            <p className="cs-muted mt-2">Your most recently edited designs. Everything you saved is in My designs.</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link href="/designs" className="cs-button cs-primary">My designs</Link>
            {isAdministrator(user) && (
              <Link href="/admin" className="cs-button">
                Administration
              </Link>
            )}
            <Link href="/dashboard/account" className="cs-button">
              Account
            </Link>
          </div>
        </div>
        <UsageBanner />
        <RecentDesigns items={recent.items.slice(0, 8)} total={recent.total} brand={activeBrand} />
      </main>
    </>
  );
}
