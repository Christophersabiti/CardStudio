/**
 * Describes which plan an account is on and why, using the same order as the
 * database's effective_plan(): an active paid period, then a running trial,
 * then Free. Pure so the header, account page, billing page and tests agree.
 */
export type PlanSource = "free" | "trial" | "paid" | "manual" | "unlimited";

export interface AccountPlan {
  code: string;
  name: string;
  source: PlanSource;
  /** ISO end of the paid period or trial; null for Free and unlimited. */
  endsAt: string | null;
  /** Whole days remaining, rounded up; null when there is no end date. */
  daysLeft: number | null;
  /** True in the final week of a paid period or trial. */
  expiringSoon: boolean;
}

export interface PlanInputs {
  plan: { code: string; name: string };
  subscription: { status: string; current_period_end: string | null; provider: string | null } | null;
  trial: { ends_at: string } | null;
  unlimited?: boolean;
  now?: number;
}

const DAY = 86_400_000;
export const EXPIRING_DAYS = 7;

export function describePlan({ plan, subscription, trial, unlimited = false, now = Date.now() }: PlanInputs): AccountPlan {
  if (unlimited) return { code: "superadmin", name: "Superadmin", source: "unlimited", endsAt: null, daysLeft: null, expiringSoon: false };
  const end = (iso: string, source: PlanSource): AccountPlan => {
    const daysLeft = Math.max(0, Math.ceil((Date.parse(iso) - now) / DAY));
    return { code: plan.code, name: plan.name, source, endsAt: iso, daysLeft, expiringSoon: daysLeft <= EXPIRING_DAYS };
  };
  const periodEnd = subscription?.current_period_end;
  if (subscription?.status === "active" && periodEnd && Date.parse(periodEnd) > now) {
    return end(periodEnd, subscription.provider === "manual" ? "manual" : "paid");
  }
  if (trial && Date.parse(trial.ends_at) > now && plan.code !== "free") return end(trial.ends_at, "trial");
  return { code: plan.code, name: plan.name, source: "free", endsAt: null, daysLeft: null, expiringSoon: false };
}

const shortDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);

/** Short text for the header badge, e.g. "Premium · until 20 Dec". */
export function planBadgeText(p: AccountPlan): string {
  if (p.source === "unlimited") return "Superadmin";
  if (p.source === "trial") return `${p.name} trial · ${days(p.daysLeft ?? 0)} left`;
  if ((p.source === "paid" || p.source === "manual") && p.endsAt) {
    return p.expiringSoon ? `${p.name} · ${days(p.daysLeft ?? 0)} left` : `${p.name} · until ${shortDate(p.endsAt)}`;
  }
  return `${p.name} plan`;
}

/** One plain sentence for the account and billing pages. */
export function planSentence(p: AccountPlan): string {
  const date = p.endsAt ? new Date(p.endsAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "";
  switch (p.source) {
    case "unlimited": return "Superadmin access: no plan limits apply to your account.";
    case "trial": return `You are on a free ${p.name} trial until ${date}. After that your account moves to Free unless you choose a plan.`;
    case "manual": return `Your ${p.name} plan was activated by an administrator and runs until ${date}.`;
    case "paid": return `Your ${p.name} plan is paid until ${date}. Renew before then to keep it.`;
    default: return `You are on the ${p.name} plan. Upgrade any time for more cards, QR codes and features.`;
  }
}
