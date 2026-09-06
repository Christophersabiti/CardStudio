import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { catalog } from "@/lib/billing/catalog";
import { upgradeOptions } from "@/lib/billing/upgrade";
import { errorResponse, jsonResponse } from "@/lib/http";
import { pesapalReady } from "@/lib/billing/pesapal";
export async function GET() {
  try {
    const u = await currentUser();
    if (!u) return jsonResponse({}, 401);
    if (u.appRole === "superadmin")
      return jsonResponse({
        name: "Superadmin",
        unlimited: true,
        free: false,
        upgrade: false,
        nearing: [],
        usage: {},
        limits: {},
      });
    const c = createAdminClient();
    const [cat, e, counts] = await Promise.all([
      catalog(),
      c.rpc("effective_plan", { account_id: u.id }),
      c.from("usage_counters").select("*").eq("owner_id", u.id),
    ]);
    if (e.error || counts.error) throw Error();
    const period = new Date().toISOString().slice(0, 7);
    const usage = Object.fromEntries(
      counts.data
        .filter(
          (v) =>
            v.period_key ===
            (v.metric.startsWith("monthly") ? period : "current"),
        )
        .map((v) => [v.metric, Number(v.value)]),
    );
    const meta = cat.presentation.find((v) => v.plan_id === e.data.id);
    const result = upgradeOptions(
      e.data,
      cat.plans,
      usage,
      meta?.upgrade_codes || [],
      cat.settings.upgrade_threshold,
    );
    const offers = result.higher.filter((p) =>
      cat.prices.some((v) => v.plan_id === p.id && v.enabled),
    );
    return jsonResponse({
      name: e.data.name,
      free: e.data.code === "free",
      usage,
      limits: e.data,
      nearing: result.nearing,
      upgrade:
        cat.settings.checkout_enabled &&
        pesapalReady() &&
        offers.length > 0 &&
        (e.data.code === "free" || result.nearing.length > 0),
      reset: new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth() + 1, 1),
      ).toISOString(),
    });
  } catch (e) {
    return errorResponse(e);
  }
}
