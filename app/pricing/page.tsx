import {currentUser} from "@/lib/auth/session";
import {createAdminClient} from "@/lib/supabase/server";
import Shell from "@/components/marketing/Shell";
import PricingPlans from "@/components/PricingPlans";
import { catalog } from "@/lib/billing/catalog";
import { pesapalReady } from "@/lib/billing/pesapal";
export const dynamic = "force-dynamic";
export default async function Pricing() {
  const cat = await catalog();
  const u=await currentUser();
  const current=u?await createAdminClient().rpc("effective_plan",{account_id:u.id}):null;
  return (
    <Shell>
      <main className="mk-detail" id="main-content">
        <p className="mk-eyebrow">Your next connection starts here</p>
        <h1>
          A clear plan.
          <br />
          Room to grow.
        </h1>
        <p className="mk-lead">
          Choose the capacity you need. Every plan includes your own card
          designs, private drafts and controlled publishing. Prices and
          allowances below are the current available offers.
        </p>
        <PricingPlans
          currentPlan={current?.data?.id}
          plans={cat.plans}
          prices={cat.prices}
          presentation={cat.presentation}
          checkout={cat.settings.checkout_enabled && pesapalReady()}
          trialDays={cat.settings.trial_enabled ? cat.settings.trial_days : 0}
        />
      </main>
    </Shell>
  );
}
