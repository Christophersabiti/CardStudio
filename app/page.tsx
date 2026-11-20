import Shell from "@/components/marketing/Shell";
import Home from "@/components/marketing/Home";
import { redirect } from "next/navigation";
import ProductShowcase from "@/components/marketing/ProductShowcase";
import { productFeature, products } from "@/lib/navigation";
import { featureFlags } from "@/lib/features";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const { mode } = await searchParams;
  if (mode === "cards" || mode === "groups") redirect(`/studio?mode=${mode}`);
  const flags = await featureFlags();
  return (
    <Shell>
      <Home showcase={<ProductShowcase items={products.filter((p) => flags[productFeature[p.key]])} />} />
    </Shell>
  );
}
