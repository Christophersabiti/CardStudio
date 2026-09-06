import Link from "next/link";
import Shell from "@/components/marketing/Shell";
import { catalog, money } from "@/lib/billing/catalog";
export const dynamic = "force-dynamic";
export default async function Pricing() {
  let data: Awaited<ReturnType<typeof catalog>> | null = null;
  try {
    data = await catalog();
  } catch {}
  return (
    <Shell>
      <main className="mk-detail" id="main-content">
        <p className="mk-eyebrow">Room for your next chapter</p>
        <h1>
          A plan for the way
          <br />
          you connect.
        </h1>
        <p className="mk-lead">
          Start simple. Choose more capacity when you need it. Paid plans renew
          manually—no automatic recurring charge.
        </p>
        {data ? (
          <div className="mk-pricing">
            {data.plans.map((p) => (
              <article className="mk-price" key={p.id}>
                <h2>{p.name}</h2>
                <div className="mk-price-value">
                  {p.code === "free"
                    ? "Free"
                    : data.prices
                        .filter((v) => v.plan_id === p.id && v.enabled)
                        .map((v) => (
                          <div key={v.id}>
                            {money(v)} <small>/{v.interval}</small>
                          </div>
                        ))}
                </div>
                <ul>
                  <li>{p.active_cards} active cards</li>
                  <li>{p.active_groups} active groups</li>
                  <li>{p.monthly_cards} new cards per calendar month</li>
                  <li>
                    {Math.round(p.storage_bytes / 1000000)} MB image storage
                  </li>
                  <li>Private drafts and controlled publishing</li>
                </ul>
                <Link
                  className="mk-button"
                  href={p.code === "free" ? "/studio" : "/billing"}
                >
                  {p.code === "free" ? "Start creating" : "View billing"} ↗
                </Link>
              </article>
            ))}
          </div>
        ) : (
          <p role="status">
            Plan details are being configured. You can still explore the studio.
          </p>
        )}
        {data?.settings.trial_enabled && (
          <p className="mk-lead">
            Eligible accounts can start a {data.settings.trial_days}-day trial
            from Billing. No payment is collected to start a trial.
          </p>
        )}
      </main>
    </Shell>
  );
}
