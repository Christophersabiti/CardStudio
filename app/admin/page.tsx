import { ArrowUpRightIcon } from "@/components/icons";
import "@/components/admin/admin.css";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import ResourceAdmin from "@/components/ResourceAdmin";
import PlanPresentationAdmin from "@/components/PlanPresentationAdmin";
import CommercialAdmin from "@/components/CommercialAdmin";
import UserActions from "@/components/admin/UserActions";
import FeatureAdmin from "@/components/admin/FeatureAdmin";
import { accountDetail, listAccounts, segments, type Segment } from "@/lib/admin/accounts";
import { currentUser } from "@/lib/auth/session";
import { isAdministrator, isSuperAdministrator } from "@/lib/roles";
import { createAdminClient } from "@/lib/supabase/server";
import { catalog, money } from "@/lib/billing/catalog";
import { pesapalReady } from "@/lib/billing/pesapal";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tab?: string; q?: string; segment?: string; user?: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect("/sign-in");
  if (!isAdministrator(u)) notFound();
  const params = await searchParams;
  const tabs = [
    ["overview", "Overview"],
    ["users", "Users"],
    ["premium", "Premium users"],
    ["features", "Features"],
    ["resources", "Cards & groups"],
    ["plans", "Plans & pricing"],
    ["stamp-plans", "E-stamp pricing"],
    ["settings", "Settings"],
    ["orders", "Orders"],
    ["audit", "Activity"],
  ] as const;
  // "accounts" was the old name for the Users tab.
  const requested = params.tab === "accounts" ? "users" : params.tab;
  const tab = tabs.some(([key]) => key === requested) ? requested! : "overview";
  const query = (params.q || "").trim().slice(0, 120);
  const segment: Segment = tab === "premium"
    ? (params.segment === "expiring" ? "expiring" : "paid")
    : (segments.some(([key]) => key === params.segment) ? params.segment as Segment : "all");
  const selectedUser = /^[0-9a-f-]{36}$/.test(params.user || "") ? params.user! : null;
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
        <SiteHeader />
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
  const directoryTab = tab === "users" || tab === "premium";
  const [cat, orders, audit, cards, groups, directory, detail, overview, flags] = await Promise.all([
    catalog(true),
    c
      .from("billing_orders")
      .select("*")
      .order("created_at", { ascending: false })
      .range((page - 1) * 25, page * 25 - 1),
    c
      .from("admin_audit")
      .select("id,actor_id,action,target_id,details,created_at")
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
    directoryTab ? listAccounts(u.id, query, segment, page) : null,
    directoryTab && selectedUser ? accountDetail(u.id, selectedUser) : null,
    tab === "overview" ? c.rpc("admin_overview", { actor: u.id }) : null,
    tab === "features" ? c.from("feature_flags").select("key,enabled,updated_at").order("key") : null,
  ]);
  // Before the admin_manual_grants migration is applied these return errors; show a notice rather than failing.
  const setupNeeded = !!(overview?.error || flags?.error);
  const stats = (overview?.data || {}) as { accounts?: number; new_7d?: number; new_30d?: number; paid?: number; manual?: number; trials?: number; expiring_7d?: number; by_plan?: Record<string, number>; manual_revenue_30d?: Record<string, number> };
  const grantPlans = cat.plans.filter((p) => p.enabled && (p.code === "basic" || p.code === "premium")).map((p) => ({ id: p.id, code: p.code, name: p.name }));
  if (
    orders.error ||
    audit.error ||
    cards.error ||
    groups.error
  )
    throw Error("Admin data unavailable");
  const paginationRows =
    directoryTab
      ? directory?.items || []
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
    users: [
      "Users",
      "Find anyone by name or email, see their plan, and give or revoke paid plans.",
    ],
    premium: [
      "Premium users",
      "Everyone on a paid plan or trial, soonest to end first.",
    ],
    features: [
      "Features",
      "Switch products on or off for every customer.",
    ],
    resources: [
      "Cards & groups",
      "Review published content and manage card visibility.",
    ],
    plans: [
      "Plans & pricing",
      "Define customer plans and how they appear on your pricing page.",
    ],
    "stamp-plans": [
      "E-stamp pricing and limits",
      "Set monthly generation allowances and schedule e-stamp plan prices. A limit of -1 allows unlimited generations.",
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
  const commercial = (section: "settings" | "plans") => (
    <CommercialAdmin section={section} settings={cat.settings} plans={cat.plans} />
  );
  const directoryHref = (extra: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { tab, q: query || undefined, segment: tab === "premium" ? (segment === "paid" ? undefined : segment) : (segment === "all" ? undefined : segment), ...extra };
    for (const [k, v] of Object.entries(merged)) if (v !== undefined && v !== "") sp.set(k, String(v));
    return `/admin?${sp.toString()}`;
  };
  const shortDate = (d: string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const sourceLabel = { free: "Free", trial: "Trial", paid: "Paid", manual: "Given by admin" } as const;
  return (
    <>
      <SiteHeader />
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
        <div className="admin-layout">
        <nav className="admin-nav" aria-label="Control center sections">
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
        <div className="admin-main">
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
          {setupNeeded && (
            <p className="admin-message is-error mb-5">The database update for user plans and feature switches has not been applied yet. Apply migration 20261120191455_admin_manual_grants.</p>
          )}
          {tab === "overview" && (
            <>
              <div className="admin-kpis">
                {[
                  ["Users", stats.accounts ?? totals[0].count, `${stats.new_7d ?? 0} new this week · ${stats.new_30d ?? 0} this month`, "/admin?tab=users"],
                  ["Paid online", stats.paid ?? 0, "Active paid plans through checkout", "/admin?tab=premium"],
                  ["Given by admin", stats.manual ?? 0, "Plans activated after outside payment", "/admin?tab=premium"],
                  ["Ending in 7 days", stats.expiring_7d ?? 0, `${stats.trials ?? 0} trials running`, "/admin?tab=premium&segment=expiring"],
                ].map(([label, value, note, href]) => (
                  <Link key={String(label)} href={String(href)} className="admin-kpi">
                    <span>{label}</span>
                    <strong>{Number(value).toLocaleString()}</strong>
                    <small>{note}</small>
                  </Link>
                ))}
              </div>
              <div className="admin-mini-stats">
                <span>Active plans: {["basic", "premium"].map((code) => `${code === "basic" ? "Basic" : "Premium"} ${stats.by_plan?.[code] ?? 0}`).join(" · ")}</span>
                <span>Recorded outside payments, 30 days: {Object.entries(stats.manual_revenue_30d || {}).map(([cur, total]) => `${cur} ${Number(total).toLocaleString()}`).join(" · ") || "none"}</span>
                <span>{totals[1].count.toLocaleString()} cards · {totals[2].count.toLocaleString()} groups · {totals[3].count.toLocaleString()} orders</span>
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
                  <Link href="/admin?tab=users" className="admin-shortcut">
                    <strong>Users and paid plans <ArrowUpRightIcon /></strong>
                    <span>
                      Find a customer, give them a plan after an outside payment, or change their access.
                    </span>
                  </Link>
                  <Link href="/admin?tab=features" className="admin-shortcut">
                    <strong>Features <ArrowUpRightIcon /></strong>
                    <span>Switch products on or off for every customer.</span>
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
          {directoryTab && directory && (
            <>
              <form className="admin-search" action="/admin" role="search">
                <input type="hidden" name="tab" value={tab} />
                {tab === "premium" ? (
                  segment === "expiring" && <input type="hidden" name="segment" value="expiring" />
                ) : (
                  segment !== "all" && <input type="hidden" name="segment" value={segment} />
                )}
                <label className="sr-only" htmlFor="admin-q">Search users</label>
                <input id="admin-q" name="q" defaultValue={query} className="cs-input" placeholder="Search by name or email" />
                <button className="cs-button cs-primary">Search</button>
                {query && <Link href={directoryHref({ q: undefined })} className="cs-button">Clear</Link>}
              </form>
              <nav className="admin-chips" aria-label="Filter users">
                {(tab === "premium" ? [["paid", "All paid & trial"], ["expiring", "Ending in 7 days"]] as const : segments).map(([key, label]) => (
                  <Link key={key} href={directoryHref({ segment: tab === "premium" ? (key === "paid" ? undefined : key) : (key === "all" ? undefined : key), page: undefined })} aria-current={segment === key ? "page" : undefined}>{label}</Link>
                ))}
              </nav>
              <p className="admin-count">{directory.total.toLocaleString()} {directory.total === 1 ? "user" : "users"}{query && <> matching “{query}”</>}</p>
              {directory.items.length ? (
                <div className="admin-table-wrap">
                  <table className="admin-table admin-users">
                    <thead><tr><th>User</th><th>Plan</th><th>Ends</th><th>Content</th><th>Joined</th></tr></thead>
                    <tbody>
                      {directory.items.map((a) => (
                        <tr key={a.id} aria-selected={selectedUser === a.id}>
                          <td>
                            <Link href={directoryHref({ user: a.id })} className="admin-user-link">
                              <strong>{a.display_name || a.email || "Unnamed account"}</strong>
                              <small>{a.email || "Email unavailable"}</small>
                            </Link>
                            {(a.app_role !== "member" || a.status !== "active") && (
                              <span className="admin-tags">
                                {a.app_role !== "member" && <span className="admin-badge">{a.app_role}</span>}
                                {a.status !== "active" && <span className="admin-badge admin-badge-warn">{a.status}</span>}
                              </span>
                            )}
                          </td>
                          <td><span className={`admin-plan admin-plan-${a.source}`}>{a.plan_name}</span><small className="block cs-muted mt-1">{sourceLabel[a.source]}</small></td>
                          <td>{a.period_end ? shortDate(a.period_end) : "—"}</td>
                          <td className="text-xs">{a.cards} cards · {a.groups} groups · {a.qr_codes} QR</td>
                          <td>{shortDate(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="admin-empty"><strong>No users found</strong><p className="mt-2">Try a different name, email or filter.</p></div>
              )}
              {selectedUser && (
                <aside className="admin-drawer" aria-label="User details">
                  <div className="admin-drawer-head">
                    {detail ? (
                      <div>
                        <h3>{detail.account.display_name || detail.account.email || "Unnamed account"}</h3>
                        <p>{detail.account.email}</p>
                        <p><span className={`admin-plan admin-plan-${detail.account.source}`}>{detail.account.plan_name}</span> {detail.account.period_end ? `until ${shortDate(detail.account.period_end)}` : ""} · joined {shortDate(detail.account.created_at)}</p>
                      </div>
                    ) : <h3>User not found</h3>}
                    <Link href={directoryHref({ user: undefined })} className="cs-button" aria-label="Close user details">Close</Link>
                  </div>
                  {detail && (
                    <>
                      <UserActions account={detail.account} grants={detail.grants} plans={grantPlans} self={detail.account.id === u.id} />
                      {detail.orders.length > 0 && (
                        <section className="admin-card">
                          <h3>Online payments</h3>
                          <ul className="admin-grants">
                            {detail.orders.map((o) => <li key={o.id}><div><strong>{money(o)}</strong><small>{shortDate(o.created_at)} · {o.status} · {o.id.slice(0, 8)}</small></div></li>)}
                          </ul>
                        </section>
                      )}
                      <p className="admin-identity mt-4">Account ID {detail.account.id}</p>
                    </>
                  )}
                </aside>
              )}
            </>
          )}
          {tab === "features" && flags && !flags.error && <FeatureAdmin flags={flags.data || []} />}
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
              <div className="admin-table-wrap mb-6"><table className="admin-table"><thead><tr><th>Customer plan</th><th>Active cards</th><th>Monthly creations</th><th>Stamp generations / month</th><th>Storage</th><th>Effective</th><th>Catalog status</th></tr></thead><tbody>{cat.plans.map(p=><tr key={p.id}><td><strong>{p.name}</strong><small className="block cs-muted">Version {p.version}</small></td><td>{p.active_cards}</td><td>{p.monthly_cards}</td><td>{p.monthly_stamps===-1?'Unlimited':p.monthly_stamps}</td><td>{Math.round(p.storage_bytes/1000000)} MB</td><td>{new Date(p.effective_at).toLocaleString()}</td><td><span className="admin-badge">{p.enabled?'Enabled':'Archived / disabled'}</span></td></tr>)}</tbody></table></div>
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
          {tab === "stamp-plans" && <>
            <div className="admin-table-wrap mb-6"><table className="admin-table"><thead><tr><th>Plan</th><th>Monthly generations</th><th>Price</th><th>Interval</th><th>Effective</th><th>Enabled</th></tr></thead><tbody>{cat.plans.map(p=>{const price=cat.prices.filter(x=>x.plan_id===p.id).sort((a,b)=>b.effective_at.localeCompare(a.effective_at))[0];return <tr key={p.id}><td>{p.name} · v{p.version}</td><td>{p.monthly_stamps===-1?'Unlimited':p.monthly_stamps}</td><td>{price?money(price):'Included'}</td><td>{price?.interval||'—'}</td><td>{new Date(price?.effective_at||p.effective_at).toLocaleString()}</td><td>{p.enabled?'Enabled':'Disabled'}</td></tr>})}</tbody></table></div>
            {commercial("plans")}
          </>}
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
                      <th>Admin / change details</th>
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
                        <td><span className="admin-identity">{a.actor_id}</span><details><summary>View recorded values</summary><pre className="text-xs whitespace-pre-wrap break-all">{JSON.stringify(a.details,null,2)}</pre></details></td>
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
        {["users", "premium", "orders", "audit", "resources"].includes(tab) && (
          <nav className="admin-footer" aria-label="Admin pagination">
            <span>Page {page}</span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link
                  className="cs-button"
                  href={directoryTab ? directoryHref({ page: page - 1 }) : `/admin?tab=${tab}&page=${page - 1}`}
                >
                  Previous
                </Link>
              )}
              {(tab === "resources"
                ? cards.data.length === 25 || groups.data.length === 25
                : paginationRows.length === 25) && (
                <Link
                  className="cs-button"
                  href={directoryTab ? directoryHref({ page: page + 1 }) : `/admin?tab=${tab}&page=${page + 1}`}
                >
                  Next
                </Link>
              )}
            </div>
          </nav>
        )}
        </div>
        </div>
      </main>
    </>
  );
}
