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
  monthly_stamps: number;
  storage_bytes: number;
  effective_at: string;
}
export interface Price {
  id: string;
  plan_id: string;
  currency: string;
  currency_exponent: number;
  amount_minor: number;
  interval: string;
  enabled: boolean;
  effective_at: string;
}
export async function catalog(all = false) {
  const c = createAdminClient();
  const planQuery = c
    .from("plans")
    .select("*")
    .order("code")
    .order("version", { ascending: false });
  const [p, v, s, meta] = await Promise.all([
    all ? planQuery : planQuery.eq("enabled", true),
    c.from("plan_prices").select("*"),
    c.from("commercial_settings").select("*").single(),
    c.from("plan_presentation").select("*"),
  ]);
  if (p.error || v.error || s.error || meta.error)
    throw Error("Billing configuration unavailable");
  const now=Date.now();
  const plans=(p.data as Plan[]).filter(x=>all||new Date(x.effective_at).getTime()<=now);
  const current=all?plans:plans.reduce((out,plan)=>{const old=out.find(x=>x.code===plan.code);if(!old)out.push(plan);else if(new Date(plan.effective_at).getTime()>new Date(old.effective_at).getTime()||(plan.effective_at===old.effective_at&&plan.version>old.version))out[out.indexOf(old)]=plan;return out;},[] as Plan[]);
  const planIds=new Set(current.map(x=>x.id));
  return {
    plans: current,
    prices: (v.data as Price[]).filter(x=>all||(planIds.has(x.plan_id)&&x.enabled&&new Date(x.effective_at).getTime()<=now)),
    settings: s.data,
    presentation: meta.data,
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
