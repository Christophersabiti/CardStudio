import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
export interface Plan {
  id: string;
  code: string;
  version: number;
  name: string;
  enabled: boolean;
  active_cards: number;
  active_groups: number;
  active_qr_codes: number;
  monthly_cards: number;
  monthly_qr_codes: number;
  storage_bytes: number;
}
export interface Price {
  id: string;
  plan_id: string;
  currency: string;
  currency_exponent: number;
  amount_minor: number;
  interval: string;
  enabled: boolean;
}
export async function catalog(all = false) {
  const c = createAdminClient();
  const planQuery = c
    .from("plans")
    .select("*")
    .order("code")
    .order("version", { ascending: false });
  const [p, v, s] = await Promise.all([
    all ? planQuery : planQuery.eq("enabled", true),
    c.from("plan_prices").select("*"),
    c.from("commercial_settings").select("*").single(),
  ]);
  if (p.error || v.error || s.error)
    throw Error("Billing configuration unavailable");
  return {
    plans: p.data as Plan[],
    prices: v.data as Price[],
    settings: s.data,
  };
}
export function money(
  p: Pick<Price, "amount_minor" | "currency" | "currency_exponent">,
) {
  return new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: p.currency_exponent,
  }).format(Number(p.amount_minor) / 10 ** p.currency_exponent);
}
