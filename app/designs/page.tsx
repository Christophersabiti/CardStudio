import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import UsageBanner from "@/components/UsageBanner";
import Library from "@/components/designs/Library";
import { currentUser, needsOnboarding } from "@/lib/auth/session";
import { listAssets } from "@/lib/assets";
import { assetListSchema, type AssetKind } from "@/lib/assets-schema";
import { activeBrand } from "@/lib/brand";
import { featureFlags } from "@/lib/features";

export const metadata: Metadata = { title: "My designs | Card Studio", robots: { index: false, follow: false } };
const FEATURE: Record<AssetKind, "cards" | "groups" | "qr_codes" | "email_signature" | "stamps" | "print_package"> = {
  card: "cards", group: "groups", qr: "qr_codes", signature: "email_signature", stamp: "stamps", print: "print_package",
};

export default async function DesignsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/designs");
  if (needsOnboarding(user)) redirect("/onboarding");
  const raw = Object.fromEntries(Object.entries(await searchParams).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]).filter(([, v]) => v !== undefined));
  const parsed = assetListSchema.safeParse(raw);
  const params = parsed.success ? parsed.data : assetListSchema.parse({});
  const [initial, flags] = await Promise.all([listAssets(user.id, { ...params, page: 1 }), featureFlags()]);
  const enabled = (Object.keys(FEATURE) as AssetKind[]).filter((k) => flags[FEATURE[k]]);
  return (
    <div className="ds-app">
      <SiteHeader />
      <div className="ds-usage"><UsageBanner /></div>
      <Library initial={initial} initialParams={{ kind: params.kind, q: params.q, section: params.section, sort: params.sort }} brand={activeBrand} enabled={enabled} />
    </div>
  );
}
