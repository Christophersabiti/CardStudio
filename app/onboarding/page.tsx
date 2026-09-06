import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { catalog, money } from "@/lib/billing/catalog";
import BillingActions from "@/components/BillingActions";
import FreePlanAction from "@/components/FreePlanAction";
import Shell from "@/components/marketing/Shell";
import { pesapalReady } from "@/lib/billing/pesapal";
export default async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const u = await currentUser();
  const intent = (await searchParams).plan || "";
  if (!u) redirect("/start?plan=" + encodeURIComponent(intent || "choose"));
  if(u.appRole==="superadmin")redirect("/admin");
  const cat = await catalog();
  const price = cat.prices.find(
    (p) =>
      p.id === intent &&
      p.enabled &&
      cat.plans.some((pl) => pl.id === p.plan_id),
  );
  return (
    <Shell>
      <main className="mk-detail" id="main-content">
        <h1>Choose your next step.</h1>
        <p className="mk-lead">
          Confirm your plan before creating your first card. Paid access starts
          after payment verification.
        </p>
        {price ? (
          <section className="cs-panel my-6">
            <h2 className="text-2xl">
              {cat.plans.find((p) => p.id === price.plan_id)?.name}
            </h2>
            <p className="my-4">
              {money(price)} per {price.interval}. Manual renewal, no automatic
              charge.
            </p>
            <BillingActions
              priceId={price.id}
              disabled={!cat.settings.checkout_enabled || !pesapalReady()}
            />
          </section>
        ) : (
          intent !== "free" && (
            <p className="my-4">
              Choose a currently available plan. An unavailable or changed offer
              cannot be activated.
            </p>
          )
        )}
        <section className="cs-panel my-6">
          <h2 className="text-xl mb-4">Start with Free</h2>
          <FreePlanAction />
        </section>
        {cat.settings.trial_enabled && (
          <section className="cs-panel my-6">
            <p className="mb-4">
              Eligible accounts may try{" "}
              {cat.plans.find((p) => p.id === cat.settings.trial_plan_id)
                ?.name || "the trial plan"}{" "}
              for {cat.settings.trial_days} days.
            </p>
            <BillingActions trial />
          </section>
        )}
        {u.onboardingComplete&&<Link href="/dashboard" className="cs-button cs-primary mr-4">Continue to My cards</Link>}
        <Link href="/pricing" className="underline">
          Compare all plans
        </Link>
        <Link href="/billing" className="underline ml-6">
          Payment status and billing
        </Link>
      </main>
    </Shell>
  );
}
