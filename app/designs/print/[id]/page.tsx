import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import FeatureUnavailable from "@/components/FeatureUnavailable";
import PrintPackageEditor, { type PrintOptions } from "@/components/designs/PrintPackageEditor";
import { currentUser, needsOnboarding } from "@/lib/auth/session";
import { touchAsset } from "@/lib/assets";
import { emptyPrintConfig, printConfigSchema } from "@/lib/assets-schema";
import { activeBrand } from "@/lib/brand";
import { featureFlags, featureName } from "@/lib/features";
import { printAccess } from "@/lib/print-package/access";
import { samePublishedContent } from "@/lib/publication";
import { createAdminClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Print package | Card Studio", robots: { index: false, follow: false } };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PrintPackagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (id !== "new" && !uuid.test(id)) notFound();
  const user = await currentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/designs/print/${id}`)}`);
  if (needsOnboarding(user)) redirect("/onboarding");
  if (!(await featureFlags()).print_package) return <><SiteHeader /><FeatureUnavailable name={featureName("print_package")} /></>;
  const c = createAdminClient();
  const [pkg, cards, qrs, stamps, access] = await Promise.all([
    id === "new" ? Promise.resolve({ data: null, error: null }) : c.from("print_packages").select("id,name,config,revision,created_at,updated_at").eq("id", id).eq("owner_id", user.id).is("deleted_at", null).maybeSingle(),
    c.from("cards").select("id,slug,data,published,published_data,revision,updated_at").eq("owner_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100),
    c.from("qr_codes").select("id,slug,title,data,published,archived_at,updated_at").eq("owner_id", user.id).is("deleted_at", null).eq("data->>version", "1").order("updated_at", { ascending: false }).limit(100),
    c.from("stamp_designs").select("id,name,design,updated_at").eq("owner_id", user.id).is("deleted_at", null).order("updated_at", { ascending: false }).limit(100),
    printAccess(user),
  ]);
  for (const r of [pkg, cards, qrs, stamps]) if (r.error) throw r.error;
  if (id !== "new" && !pkg.data) notFound();
  if (pkg.data) await touchAsset(user.id, "print", pkg.data.id);
  const names = await c.from("design_assets").select("kind,source_id,name").eq("owner_id", user.id).in("kind", ["card", "qr"]).not("name", "is", null);
  const label = (kind: string, sourceId: string, fallback: string) => names.data?.find((n) => n.kind === kind && n.source_id === sourceId)?.name || fallback;
  const options: PrintOptions = {
    cards: (cards.data || []).map((x) => ({ id: x.id, slug: x.slug, revision: x.revision, data: x.data, name: label("card", x.id, `${x.data?.firstName || ""} ${x.data?.lastName || ""}`.trim() || "Untitled business card"), dynamic: (x.data?.qrMode || "dynamic") === "dynamic", upToDate: x.published && samePublishedContent(x.data, x.published_data) })),
    qrs: (qrs.data || []).map((x) => ({ id: x.id, slug: x.slug, name: label("qr", x.id, x.title), data: x.data, ready: x.published && !x.archived_at })),
    stamps: (stamps.data || []).map((x) => ({ id: x.id, name: x.name, design: x.design })),
  };
  const parsed = pkg.data ? printConfigSchema.safeParse(pkg.data.config) : null;
  const initial = pkg.data ? { id: pkg.data.id, name: pkg.data.name, revision: pkg.data.revision, createdAt: pkg.data.created_at, updatedAt: pkg.data.updated_at, config: parsed?.success ? parsed.data : emptyPrintConfig() } : null;
  return (
    <div className="ds-app">
      <SiteHeader />
      <PrintPackageEditor initial={initial} options={options} brand={activeBrand} printAllowed={access.allowed} />
    </div>
  );
}
