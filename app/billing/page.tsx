import UsageBanner from "@/components/UsageBanner";
/* eslint-disable react-hooks/purity -- Request-time server rendering of expiry dates; no client render clock. */
import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import BillingActions from "@/components/BillingActions";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { catalog, money } from "@/lib/billing/catalog";
import { pesapalReady } from "@/lib/billing/pesapal";
export default async function Billing() {
  const u = await currentUser();
  if (!u) redirect("/sign-in?next=/billing");
  const c = createAdminClient();
  const [cat, e, s, t, usage, orders] = await Promise.all([
    catalog(),
    c.rpc("effective_plan", { account_id: u.id }),
    c.from("subscriptions").select("*").eq("owner_id", u.id).single(),
    c.from("account_trials").select("*").eq("owner_id", u.id).maybeSingle(),
    c.from("usage_counters").select("*").eq("owner_id", u.id),
    c
      .from("billing_orders")
      .select("*")
      .eq("owner_id", u.id)
      .order("created_at", { ascending: false })
      .limit(30),
  ]);
  if (e.error || s.error || t.error || usage.error || orders.error)
    throw Error("Billing unavailable");
  const period = new Date().toISOString().slice(0, 7);
  return (
    <>
      <Header brand={activeBrand} />
      <main className="max-w-6xl mx-auto px-5 pb-16">
        <div className="flex justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Billing & usage</h1>
            <p className="cs-muted mt-2">
              Manage your plan and keep track of your capacity.
            </p>
          </div>
          <Link href="/dashboard" className="cs-button self-start">
            My cards
          </Link>
        </div>
        <UsageBanner/>
        <section className="cs-panel my-6">
          <h2 className="text-xl">Current plan: {e.data.name}</h2>
          <p className="cs-muted mt-2">
            {s.data.status === "active"
              ? `Paid until ${new Date(s.data.current_period_end).toLocaleDateString("en-GB")}. Renew manually to continue your paid plan.`
              : "No automatic recurring charges."}
          </p>
          {t.data && (
            <p className="mt-2">
              Trial {Date.parse(t.data.ends_at) > Date.now() ? "ends" : "ended"}{" "}
              {new Date(t.data.ends_at).toLocaleDateString("en-GB")}.
            </p>
          )}
          {cat.settings.trial_enabled &&
            !t.data &&
            s.data.status !== "active" && (
              <div className="mt-4">
                <p className="mb-3">
                  Try the configured trial plan for {cat.settings.trial_days}{" "}
                  days. No payment required.
                </p>
                <BillingActions trial />
              </div>
            )}
        </section>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            ["active_cards", "Active cards"],
            ["active_groups", "Active groups"],
            ["monthly_cards", "Cards created this month"],
            ["storage_bytes", "Image storage"],
          ].map(([metric, label]) => {
            const value = Number(
              usage.data.find(
                (v) =>
                  v.metric === metric &&
                  v.period_key ===
                    (metric.startsWith("monthly") ? period : "current"),
              )?.value || 0,
            );
            const cap = Number(e.data[metric]);
            return (
              <section className="cs-panel" key={metric}>
                <h2 className="text-sm">{label}</h2>
                <p className="text-2xl font-semibold mt-3">
                  {metric === "storage_bytes"
                    ? `${(value / 1000000).toFixed(1)} / ${(cap / 1000000).toFixed(0)} MB`
                    : `${value} / ${u.appRole === "superadmin" ? "Unlimited" : cap}`}
                </p>
                <progress
                  aria-label={label}
                  className="w-full mt-3"
                  value={Math.min(value, cap)}
                  max={Math.max(1, cap)}
                />
              </section>
            );
          })}
        </div>
        <h2 className="text-2xl mt-10 mb-4">Choose a plan</h2>
        <div className="grid md:grid-cols-3 gap-4">
          {cat.prices
            .filter(
              (p) => p.enabled && cat.plans.some((pl) => pl.id === p.plan_id),
            )
            .map((p) => (
              <article className="cs-panel" key={p.id}>
                <h3 className="text-xl">
                  {cat.plans.find((pl) => pl.id === p.plan_id)?.name}
                </h3>
                <p className="text-xl my-4">
                  {money(p)} / {p.interval}
                </p>
                <BillingActions
                  priceId={p.id}
                  disabled={!cat.settings.checkout_enabled || !pesapalReady()}
                />
              </article>
            ))}
        </div>
        {!cat.prices.some((p) => p.enabled) && (
          <p className="cs-muted">Paid plans have not been enabled yet.</p>
        )}
        <h2 className="text-2xl mt-10 mb-4">Payment history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th className="p-3">Order</th>
                <th>Date</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <tr className="border-t" key={o.id}>
                  <td className="p-3">
                    <Link
                      className="underline"
                      href={`/billing/orders/${o.id}`}
                    >
                      {o.id.slice(0, 8)}
                    </Link>
                  </td>
                  <td>{new Date(o.created_at).toLocaleDateString("en-GB")}</td>
                  <td>{money(o)}</td>
                  <td>
                    {o.status === "pending" &&
                    Date.parse(o.expires_at) < Date.now()
                      ? "Expired / awaiting verification"
                      : o.status}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.data.length === 0 && (
            <p className="cs-muted p-3">No payments yet.</p>
          )}
        </div>
      </main>
    </>
  );
}
