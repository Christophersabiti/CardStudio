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
    const [cat, e, counts, profile] = await Promise.all([
      catalog(),
      c.rpc("effective_plan", { account_id: u.id }),
      c.from("usage_counters").select("*").eq("owner_id", u.id),
      c.from("profiles").select("timezone").eq("user_id",u.id).maybeSingle(),
    ]);
    if (e.error || counts.error || profile.error) throw Error();
    const zone=profile.data?.timezone||"UTC", now=new Date();
    const parts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit"}).formatToParts(now);
    const period=`${parts.find(p=>p.type==="year")?.value}-${parts.find(p=>p.type==="month")?.value}`;
    const [year,month]=period.split("-").map(Number), localMidnight=Date.UTC(year,month,1);
    const resetParts=new Intl.DateTimeFormat("en-CA",{timeZone:zone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(new Date(localMidnight));
    const part=(type:string)=>Number(resetParts.find(p=>p.type===type)?.value);
    const offset=Date.UTC(part("year"),part("month")-1,part("day"),part("hour"),part("minute"))-localMidnight;
    const reset=new Date(localMidnight-offset).toISOString();
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
      timezone: zone,
      free: e.data.code === "free",
      usage,
      limits: e.data,
      nearing: result.nearing,
      upgrade:
        cat.settings.checkout_enabled &&
        pesapalReady() &&
        offers.length > 0 &&
        (e.data.code === "free" || result.nearing.length > 0),
      reset,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
