import { ArrowUpRightIcon } from "@/components/icons";
import "@/components/admin/admin.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import ResourceAdmin from "@/components/ResourceAdmin";
import PlanPresentationAdmin from "@/components/PlanPresentationAdmin";
import CommercialAdmin from "@/components/CommercialAdmin";
import { activeBrand } from "@/lib/brand";
import { currentUser } from "@/lib/auth/session";
import { isAdministrator, isSuperAdministrator } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/server";
import { catalog, money } from "@/lib/billing/catalog";
import { pesapalReady } from "@/lib/billing/pesapal";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect("/sign-in");
  if (!isAdministrator(u)) notFound();
  const params = await searchParams;
  const tabs = [
    ["overview", "Overview"],
    ["accounts", "Accounts"],
    ["resources", "Cards & groups"],
    ["plans", "Plans & pricing"],
    ["settings", "Settings"],
    ["orders", "Orders"],
    ["audit", "Activity"],
  ] as const;
  const tab = tabs.some(([key]) => key === params.tab)
    ? params.tab!
    : "overview";
  const c = createAdminClient();
  const page = Math.max(
    1,
    Math.min(10000, Math.floor(Number(params.page)) || 1),
  );
  const totals = await Promise.all(
    ["users", "cards", "groups", "billing_orders"].map(async (table) => {
      const { count, error } = await c
        .from(table)
        .select("id", { head: true, count: "exact" });
      if (error) throw error;
      return { table, count: count || 0 };
    }),
  );
  if (!isSuperAdministrator(u))
    return (
      <>
        <Header brand={activeBrand} />
        <main className="max-w-5xl mx-auto p-5">
          <h1 className="text-3xl">Administration</h1>
          <p className="mt-4">
            Commercial configuration and account management require superadmin
            access.
          </p>
          <Link href="/dashboard" className="cs-button inline-block mt-5">
            My dashboard
          </Link>
        </main>
      </>
    );
  const [cat, accounts, orders, audit, cards, groups] = await Promise.all([
    catalog(true),
    c
      .from("users")
      .select("id,app_role,status,clerk_user_id,profiles(display_name)")
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
    c
      .from("billing_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
    c
      .from("admin_audit")
      .select("id,action,target_id,created_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
    c
      .from("cards")
      .select("id,slug,owner_id,published,deleted_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
    c
      .from("groups")
      .select("id,slug,owner_id,published,deleted_at")
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
  ]);
  if (
    accounts.error ||
    orders.error ||
    audit.error ||
    cards.error ||
    groups.error
  )
    throw Error("Admin data unavailable");
  const accountRows = accounts.data as unknown as Parameters<
    typeof CommercialAdmin
  >[0]["accounts"];
  const paginationRows =
    tab === "accounts"
      ? accounts.data
      : tab === "orders"
        ? orders.data
        : tab === "audit"
          ? audit.data
          : tab === "resources"
            ? [...cards.data, ...groups.data]
            : [];
  const descriptions: Record<string, [string, string]> = {
    overview: [
      "Platform overview",
      "A clear view of your workspace and commercial settings.",
    ],
    accounts: [
      "Account management",
      "Manage roles and access across your platform.",
    ],
    resources: [
      "Cards & groups",
      "Review published content and manage card visibility.",
    ],
    plans: [
      "Plans & pricing",
      "Define customer plans and how they appear on your pricing page.",
    ],
    settings: [
      "Platform settings",
      "Control customer quotas, payment availability and trial periods.",
    ],
    orders: [
      "Customer orders",
      "Review payment references and transaction status.",
    ],
    audit: [
      "Activity log",
      "A record of administrative changes across your platform.",
    ],
  };
  const commercial = (section: "settings" | "plans" | "accounts") => (
    <CommercialAdmin
      section={section}
      settings={cat.settings}
      plans={cat.plans}
      accounts={accountRows}
    />
  );
  return (
    <>
      <Header brand={activeBrand} />
      <main className="admin-shell">
        <header className="admin-heading">
          <div>
            <span className="admin-eyebrow">Card Studio / Administration</span>
            <h1>Control center</h1>
            <p>{u.email}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="admin-access">Superadmin · Unlimited access</span>
            <Link href="/dashboard" className="cs-button">
              My cards <ArrowUpRightIcon />
            </Link>
          </div>
        </header>
        <nav className="admin-nav" aria-label="Control center tabs">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={`/admin?tab=${key}`}
              aria-current={tab === key ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <section aria-label={descriptions[tab][0]}>
          <div className="admin-section-heading">
            <div>
              <h2>{descriptions[tab][0]}</h2>
              <p>{descriptions[tab][1]}</p>
            </div>
            {tab === "overview" && (
              <span className="admin-badge">Live platform data</span>
            )}
          </div>
          {tab === "overview" && (
            <>
              <div className="admin-kpis">
                {totals.map((t, i) => (
                  <section key={t.table} className="admin-kpi">
                    <span>
                      {
                        [
                          "Total accounts",
                          "Individual cards",
                          "Contact groups",
                          "Customer orders",
                        ][i]
                      }
                    </span>
                    <strong>{t.count.toLocaleString()}</strong>
                    <small>Across all accounts</small>
                  </section>
                ))}
              </div>
              <div className="admin-columns">
                <section className="cs-panel">
                  <h3 className="text-lg font-bold mb-3">Platform status</h3>
                  {[
                    [
                      "Payment gateway",
                      pesapalReady()
                        ? `Pesapal · ${process.env.PESAPAL_ENVIRONMENT}`
                        : "Setup incomplete",
                    ],
                    [
                      "Customer checkout",
                      cat.settings.checkout_enabled ? "Enabled" : "Disabled",
                    ],
                    [
                      "Customer quotas",
                      cat.settings.quotas_enabled ? "Enforced" : "Disabled",
                    ],
                    [
                      "Free trials",
                      cat.settings.trial_enabled
                        ? `${cat.settings.trial_days} days`
                        : "Disabled",
                    ],
                    ["Your account", "Unlimited · No subscription required"],
                  ].map(([label, value]) => (
                    <div key={label} className="admin-status-row">
                      <span>{label}</span>
                      <span className="admin-badge">{value}</span>
                    </div>
                  ))}
                </section>
                <section className="cs-panel">
                  <h3 className="text-lg font-bold">Manage your platform</h3>
                  <Link href="/admin?tab=accounts" className="admin-shortcut">
                    <strong>Account access <ArrowUpRightIcon /></strong>
                    <span>
                      Review members, administrators and account status.
                    </span>
                  </Link>
                  <Link href="/admin?tab=plans" className="admin-shortcut">
                    <strong>Plans & pricing <ArrowUpRightIcon /></strong>
                    <span>
                      Manage customer allowances, prices and plan presentation.
                    </span>
                  </Link>
                  <Link href="/admin?tab=resources" className="admin-shortcut">
                    <strong>Content management <ArrowUpRightIcon /></strong>
                    <span>
                      Review cards and groups without leaving the control
                      center.
                    </span>
                  </Link>
                </section>
              </div>
            </>
          )}
          {tab === "accounts" && commercial("accounts")}
          {tab === "settings" && (
            <>
              <p className="cs-panel mb-6">
                These settings apply to customer accounts. Superadmins are
                exempt from all plan quotas and do not require a paid
                subscription.
              </p>
              {commercial("settings")}
            </>
          )}
          {tab === "plans" && (
            <>
              <div className="admin-table-wrap mb-6"><table className="admin-table"><thead><tr><th>Customer plan</th><th>Active cards</th><th>Monthly creations</th><th>Storage</th><th>Catalog status</th></tr></thead><tbody>{cat.plans.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small className="block cs-muted">Version {p.version}</small></td><td>{p.active_cards}</td><td>{p.monthly_cards}</td><td>{Math.round(p.storage_bytes/1000000)} MB</td><td><span className="admin-badge">{p.enabled?'Enabled':'Archived / disabled'}</span></td></tr>)}</tbody></table></div>
              <details className="cs-panel mb-6">
                <summary className="font-bold">
                  Create a customer plan version
                </summary>
                <div className="mt-5">{commercial("plans")}</div>
              </details>
              <PlanPresentationAdmin
                plans={cat.plans}
                items={cat.presentation}
                threshold={cat.settings.upgrade_threshold}
              />
            </>
          )}
          {tab === "resources" && (
            <ResourceAdmin
              resources={[
                ...cards.data.map((c) => ({ ...c, kind: "cards" })),
                ...groups.data.map((g) => ({ ...g, kind: "groups" })),
              ]}
            />
          )}
          {tab === "orders" &&
            (orders.data.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Order reference</th>
                      <th>Account</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.data.map((o) => (
                      <tr key={o.id}>
                        <td>
                          <span title={o.id}>{o.id.slice(0, 8)}</span>
                          <small className="block text-xs cs-muted mt-1">
                            {new Date(o.created_at).toLocaleDateString("en-GB")}
                          </small>
                        </td>
                        <td className="admin-identity">{o.owner_id}</td>
                        <td>{money(o)}</td>
                        <td>
                          <span className="admin-badge">{o.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                <strong>No customer orders yet</strong>
                <p className="mt-2">
                  Orders will appear here when customers begin checkout.
                </p>
              </div>
            ))}
          {tab === "audit" &&
            (audit.data.length ? (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Action</th>
                      <th>Target</th>
                    </tr>
                  </thead>
                  <tbody>
                    {audit.data.map((a) => (
                      <tr key={a.id}>
                        <td>
                          {new Date(a.created_at).toLocaleString("en-GB")}
                        </td>
                        <td>{a.action.replaceAll("_", " ")}</td>
                        <td className="admin-identity">
                          {a.target_id || "Platform settings"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="admin-empty">
                Administrative changes will appear here.
              </div>
            ))}
        </section>
        {["accounts", "orders", "audit", "resources"].includes(tab) && (
          <nav className="admin-footer" aria-label="Admin pagination">
            <span>Page {page}</span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link
                  className="cs-button"
                  href={`/admin?tab=${tab}&page=${page - 1}`}
                >
                  Previous
                </Link>
              )}
              {(tab === "resources"
                ? cards.data.length === 25 || groups.data.length === 25
                : paginationRows.length === 25) && (
                <Link
                  className="cs-button"
                  href={`/admin?tab=${tab}&page=${page + 1}`}
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
      </main>
    </>
  );
}
