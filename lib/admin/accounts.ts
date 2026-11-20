import "server-only";
import { clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";

export const segments = [
  ["all", "All users"],
  ["paid", "Paid & trial"],
  ["expiring", "Ending in 7 days"],
  ["free", "Free"],
  ["admins", "Administrators"],
  ["disabled", "Disabled"],
] as const;
export type Segment = (typeof segments)[number][0];

export interface AccountRow {
  id: string;
  clerk_user_id: string | null;
  app_role: "member" | "admin" | "superadmin";
  status: "active" | "disabled";
  created_at: string;
  display_name: string;
  plan_code: string;
  plan_name: string;
  source: "free" | "trial" | "paid" | "manual";
  period_end: string | null;
  cards: number;
  groups: number;
  qr_codes: number;
  email: string;
}

/** Email addresses live in Clerk, not the database. Fetch them only for the rows being shown. */
async function emailsFor(clerkIds: string[]) {
  const ids = clerkIds.filter(Boolean);
  if (!ids.length) return new Map<string, string>();
  try {
    const { data } = await (await clerkClient()).users.getUserList({ userId: ids, limit: ids.length });
    return new Map(data.map((u) => [u.id, u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId)?.emailAddress || ""]));
  } catch {
    return new Map<string, string>();
  }
}

/** Clerk matches the search against email, phone and name; the database matches display names and IDs. */
async function clerkMatches(query: string) {
  if (query.trim().length < 2) return [];
  try {
    const { data } = await (await clerkClient()).users.getUserList({ query: query.trim(), limit: 100 });
    return data.map((u) => u.id);
  } catch {
    return [];
  }
}

export async function listAccounts(actor: string, query: string, segment: Segment, page: number) {
  const ids = await clerkMatches(query);
  const { data, error } = await createAdminClient().rpc("admin_list_accounts", {
    actor,
    query,
    clerk_ids: ids,
    segment,
    page_number: page,
  });
  if (error) throw Error("Account directory unavailable");
  const result = data as { total: number; items: Omit<AccountRow, "email">[] };
  const emails = await emailsFor(result.items.map((i) => i.clerk_user_id || ""));
  return { total: result.total, items: result.items.map((i) => ({ ...i, email: emails.get(i.clerk_user_id || "") || "" })) };
}

export interface GrantRow {
  id: string;
  plan_id: string;
  months: number;
  period_start: string;
  period_end: string;
  payment_reference: string;
  note: string;
  amount_minor: number | null;
  currency: string | null;
  revoked_at: string | null;
  revoke_reason: string | null;
  created_at: string;
}

/** Everything the user drawer shows for one account. */
export async function accountDetail(actor: string, id: string) {
  const c = createAdminClient();
  const [row, grants, orders] = await Promise.all([
    c.rpc("admin_list_accounts", { actor, query: id, clerk_ids: [], segment: "all", page_number: 1 }),
    c.from("manual_grants").select("id,plan_id,months,period_start,period_end,payment_reference,note,amount_minor,currency,revoked_at,revoke_reason,created_at").eq("owner_id", id).order("created_at", { ascending: false }).limit(20),
    c.from("billing_orders").select("id,status,amount_minor,currency,currency_exponent,created_at").eq("owner_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (row.error || grants.error || orders.error) throw Error("Account detail unavailable");
  const item = (row.data as { items: Omit<AccountRow, "email">[] }).items.find((i) => i.id === id);
  if (!item) return null;
  const emails = await emailsFor([item.clerk_user_id || ""]);
  return {
    account: { ...item, email: emails.get(item.clerk_user_id || "") || "" } as AccountRow,
    grants: grants.data as GrantRow[],
    orders: orders.data as { id: string; status: string; amount_minor: number; currency: string; currency_exponent: number; created_at: string }[],
  };
}
