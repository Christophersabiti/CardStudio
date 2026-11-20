import "server-only";
import type { SessionUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { catalog } from "@/lib/billing/catalog";
import { upgradeOptions } from "@/lib/billing/upgrade";
import { pesapalReady } from "@/lib/billing/pesapal";
import { describePlan, type AccountPlan } from "@/lib/billing/account-plan";
import { isAdministrator } from "@/lib/roles";

export interface AccountSummary {
  name: string;
  plan: AccountPlan;
  admin: boolean;
  unlimited?: boolean;
  free: boolean;
  upgrade: boolean;
  nearing: string[];
  usage: Record<string, number>;
  limits: Record<string, number>;
  reset?: string;
  timezone?: string;
}

/** Monthly counters reset at local midnight on the 1st in the profile's timezone. */
export function usagePeriod(zone: string, now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit" }).formatToParts(now);
  const period = `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`;
  const [year, month] = period.split("-").map(Number), localMidnight = Date.UTC(year, month, 1);
  const resetParts = new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(localMidnight));
  const part = (type: string) => Number(resetParts.find((p) => p.type === type)?.value);
  const offset = Date.UTC(part("year"), part("month") - 1, part("day"), part("hour"), part("minute")) - localMidnight;
  return { period, reset: new Date(localMidnight - offset).toISOString() };
}

/** Plan, usage and upgrade state for the verified user. Every query filters by user.id. */
export async function accountSummary(user: SessionUser): Promise<AccountSummary> {
  const admin = isAdministrator(user);
  if (user.appRole === "superadmin") {
    return { name: "Superadmin", plan: describePlan({ plan: { code: "free", name: "Free" }, subscription: null, trial: null, unlimited: true }), admin, unlimited: true, free: false, upgrade: false, nearing: [], usage: {}, limits: {} };
  }
  const c = createAdminClient();
  const [cat, e, counts, profile, sub, trial] = await Promise.all([
    catalog(),
    c.rpc("effective_plan", { account_id: user.id }),
    c.from("usage_counters").select("*").eq("owner_id", user.id),
    c.from("profiles").select("timezone").eq("user_id", user.id).maybeSingle(),
    c.from("subscriptions").select("status,current_period_end,provider").eq("owner_id", user.id).maybeSingle(),
    c.from("account_trials").select("ends_at").eq("owner_id", user.id).maybeSingle(),
  ]);
  if (e.error || counts.error || profile.error || sub.error || trial.error) throw Error("Account summary unavailable");
  const zone = profile.data?.timezone || "UTC";
  const { period, reset } = usagePeriod(zone);
  const usage = Object.fromEntries(
    counts.data
      .filter((v) => v.period_key === (v.metric.startsWith("monthly") ? period : "current"))
      .map((v) => [v.metric, Number(v.value)]),
  );
  const meta = cat.presentation.find((v) => v.plan_id === e.data.id);
  const result = upgradeOptions(e.data, cat.plans, usage, meta?.upgrade_codes || [], cat.settings.upgrade_threshold);
  const offers = result.higher.filter((p) => cat.prices.some((v) => v.plan_id === p.id && v.enabled));
  return {
    name: e.data.name,
    plan: describePlan({ plan: e.data, subscription: sub.data, trial: trial.data }),
    admin,
    timezone: zone,
    free: e.data.code === "free",
    usage,
    limits: e.data,
    nearing: result.nearing,
    upgrade: cat.settings.checkout_enabled && pesapalReady() && offers.length > 0 && (e.data.code === "free" || result.nearing.length > 0),
    reset,
  };
}
