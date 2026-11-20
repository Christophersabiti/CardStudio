"use client";
import Link from "next/link";
import { SignOutButton, useUser } from "@clerk/nextjs";
import type { AccountSummary } from "@/lib/billing/account-summary";
import { planBadgeText, planSentence } from "@/lib/billing/account-plan";

const meters = [
  ["active_cards", "Active cards"],
  ["active_qr_codes", "Active QR codes"],
  ["monthly_stamps", "E-stamps this month"],
  ["storage_bytes", "Image storage"],
] as const;

function Meter({ label, used, limit, bytes }: { label: string; used: number; limit: number; bytes: boolean }) {
  const unlimited = limit === -1;
  const show = (n: number) => (bytes ? `${(n / 1_000_000).toFixed(n < 10_000_000 ? 1 : 0)} MB` : String(n));
  const pct = unlimited || limit <= 0 ? 0 : Math.min(100, Math.round((used / limit) * 100));
  return (
    <div className="acct-meter">
      <div className="acct-meter-head">
        <span>{label}</span>
        <strong>{show(used)} / {unlimited ? "Unlimited" : show(limit)}</strong>
      </div>
      {!unlimited && (
        <div className="acct-bar" role="progressbar" aria-label={label} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${pct}%` }} className={pct >= 80 ? "is-high" : undefined} />
        </div>
      )}
    </div>
  );
}

/** Profile card at the top of the account page. Identity comes live from Clerk so edits below show at once. */
export default function AccountOverview({ summary }: { summary: AccountSummary }) {
  const { user } = useUser();
  const name = user?.fullName || user?.firstName || "Your account";
  const email = user?.primaryEmailAddress?.emailAddress || "";
  const plan = summary.plan;
  const showUpgrade = plan.source === "free" || plan.expiringSoon;

  return (
    <section className="acct-card" aria-labelledby="account-heading">
      <div className="acct-identity">
        {user?.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.imageUrl} alt="" width={72} height={72} className="acct-photo" />
        ) : (
          <span className="acct-photo acct-photo-empty" aria-hidden>{name[0]}</span>
        )}
        <div className="min-w-0">
          <h1 id="account-heading" className="text-2xl font-bold">{name}</h1>
          {email && <p className="cs-muted text-sm mt-1 break-all">{email}</p>}
          <p className={`acct-plan acct-plan-${plan.expiringSoon ? "expiring" : plan.source}`}>{planBadgeText(plan)}</p>
        </div>
      </div>

      <p className="mt-4">{planSentence(plan)}</p>

      {!summary.unlimited && (
        <div className="acct-meters">
          {meters.map(([key, label]) => (
            <Meter key={key} label={label} used={summary.usage[key] || 0} limit={Number(summary.limits[key] ?? 0)} bytes={key === "storage_bytes"} />
          ))}
        </div>
      )}

      <div className="acct-actions">
        <a href="#account-settings" className="cs-button">Change name or photo</a>
        <Link href="/dashboard/account/security" className="cs-button">Change password</Link>
        <Link href="/billing" className="cs-button">Billing & usage</Link>
        {showUpgrade && !summary.unlimited && <Link href="/pricing" className="cs-button cs-primary">{plan.source === "free" ? "Upgrade plan" : "Renew plan"}</Link>}
        {summary.admin && <Link href="/admin" className="cs-button">Administration</Link>}
        <SignOutButton redirectUrl="/sign-in"><button type="button" className="cs-button">Sign out</button></SignOutButton>
      </div>
    </section>
  );
}
