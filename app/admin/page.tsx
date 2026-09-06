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
  searchParams: Promise<{ page?: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect("/sign-in");
  if (!isAdministrator(u)) notFound();
  const c = createAdminClient();
  const page = Math.max(
    1,
    Math.min(10000, Number((await searchParams).page) || 1),
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
  return (
    <>
      <Header brand={activeBrand} />
      <main className="max-w-7xl mx-auto px-5 pb-16">
        <div className="flex justify-between flex-wrap gap-3">
          <div>
            <p className="text-xs cs-muted uppercase tracking-widest">
              Superadmin
            </p>
            <h1 className="text-3xl font-bold mt-2">Control center</h1>
            <p className="cs-muted mt-2">{u.email}</p>
          </div>
          <div className="flex gap-2 items-start">
            <Link href="/billing" className="cs-button">
              My billing
            </Link>
            <Link href="/dashboard" className="cs-button">
              My cards
            </Link>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 my-6">
          {totals.map((t) => (
            <section className="cs-panel" key={t.table}>
              <h2 className="capitalize text-sm">
                {t.table.replace("_", " ")}
              </h2>
              <p className="text-3xl mt-3">{t.count}</p>
            </section>
          ))}
        </div>
        <p className="cs-panel">
          Pesapal:{" "}
          {pesapalReady()
            ? `configured for ${process.env.PESAPAL_ENVIRONMENT}`
            : "setup incomplete"}{" "}
          · Checkout: {cat.settings.checkout_enabled ? "enabled" : "disabled"}
        </p>
        <PlanPresentationAdmin plans={cat.plans} items={cat.presentation} threshold={cat.settings.upgrade_threshold}/>
        <CommercialAdmin
          settings={cat.settings}
          plans={cat.plans}
          accounts={
            accounts.data as unknown as Parameters<
              typeof CommercialAdmin
            >[0]["accounts"]
          }
        />
        <ResourceAdmin
          resources={[
            ...cards.data.map((c) => ({ ...c, kind: "cards" })),
            ...groups.data.map((g) => ({ ...g, kind: "groups" })),
          ]}
        />
        <h2 className="text-2xl mt-10 mb-4">Orders across all accounts</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr>
                <th>Reference</th>
                <th>Account</th>
                <th>Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {orders.data.map((o) => (
                <tr className="border-t" key={o.id}>
                  <td className="py-3">{o.id}</td>
                  <td>{o.owner_id}</td>
                  <td>{money(o)}</td>
                  <td>{o.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h2 className="text-2xl mt-10 mb-4">Administrative audit</h2>
        <div className="grid gap-2">
          {audit.data.map((a) => (
            <div className="cs-panel text-sm" key={a.id}>
              {new Date(a.created_at).toLocaleString("en-GB")} · {a.action} ·{" "}
              {a.target_id || "Global settings"}
            </div>
          ))}
        </div>
        <nav className="flex gap-3 mt-6" aria-label="Admin pagination">
          {page > 1 && (
            <Link className="cs-button" href={`/admin?page=${page - 1}`}>
              Previous
            </Link>
          )}
          {[
            accounts.data,
            orders.data,
            audit.data,
            cards.data,
            groups.data,
          ].some((r) => r.length === 25) && (
            <Link className="cs-button" href={`/admin?page=${page + 1}`}>
              Next
            </Link>
          )}
        </nav>
      </main>
    </>
  );
}
