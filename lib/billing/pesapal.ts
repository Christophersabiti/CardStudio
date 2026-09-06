import "server-only";
import { HttpError } from "@/lib/http";
import { createAdminClient } from "@/lib/supabase/server";
import { trustedPesapalRedirect, verifiedAmountMinor } from "./validation";
export function pesapalReady() {
  return (
    ["live", "sandbox"].includes(process.env.PESAPAL_ENVIRONMENT || "") &&
    !!process.env.PESAPAL_CONSUMER_KEY &&
    !!process.env.PESAPAL_CONSUMER_SECRET &&
    !!process.env.PESAPAL_IPN_ID
  );
}
function environment() {
  if (!pesapalReady())
    throw new HttpError(503, "Checkout is not configured yet.");
  return process.env.PESAPAL_ENVIRONMENT!;
}
function base() {
  return environment() === "live"
    ? "https://pay.pesapal.com/v3/api"
    : "https://cybqa.pesapal.com/pesapalv3/api";
}
async function token() {
  const r = await fetch(base() + "/Auth/RequestToken", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      consumer_key: process.env.PESAPAL_CONSUMER_KEY,
      consumer_secret: process.env.PESAPAL_CONSUMER_SECRET,
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(15000),
  });
  const d = await r.json();
  if (!r.ok || !d.token)
    throw new HttpError(
      503,
      "Payment provider is unavailable. Please try again later.",
    );
  return d.token as string;
}
async function provider(path: string, body?: unknown) {
  const access = await token();
  const r = await fetch(base() + path, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    signal: AbortSignal.timeout(20000),
  });
  const d = await r.json();
  if (!r.ok || String(d.status) !== "200")
    throw new HttpError(
      503,
      "Payment verification is temporarily unavailable.",
    );
  return d;
}
export async function submitOrder(
  order: {
    id: string;
    amount_minor: number;
    currency: string;
    currency_exponent: number;
  },
  email: string,
) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL!;
  const d = await provider("/Transactions/SubmitOrderRequest", {
    id: order.id,
    currency: order.currency,
    amount: Number(order.amount_minor) / 10 ** order.currency_exponent,
    description: "Card Studio subscription",
    callback_url: origin + "/billing/return",
    cancellation_url: origin + "/billing",
    notification_id: process.env.PESAPAL_IPN_ID,
    billing_address: { email_address: email },
  });
  if (d.merchant_reference !== order.id || !d.order_tracking_id)
    throw Error("Payment reference mismatch");
  return {
    tracking: String(d.order_tracking_id),
    redirect: trustedPesapalRedirect(d.redirect_url, environment()),
  };
}
export async function reconcilePayment(tracking: string, reference: string) {
  const c = createAdminClient();
  const { data: p, error } = await c
    .from("payments")
    .select("id,amount_minor,currency,currency_exponent,provider_tracking_id")
    .eq("order_id", reference)
    .eq("provider", "pesapal")
    .single();
  if (error || !p) throw new HttpError(404, "Payment not found.");
  if (p.provider_tracking_id && p.provider_tracking_id !== tracking)
    throw new HttpError(400, "Payment reference mismatch.");
  const d = await provider(
    "/Transactions/GetTransactionStatus?orderTrackingId=" +
      encodeURIComponent(tracking),
  );
  if (d.merchant_reference !== reference || d.currency !== p.currency)
    throw Error("Payment verification mismatch");
  const amount = verifiedAmountMinor(d.amount, p.currency_exponent);
  if (amount !== Number(p.amount_minor)) throw Error("Payment amount mismatch");
  const { data, error: failure } = await c.rpc("fulfill_pesapal", {
    tracking,
    reference,
    paid_minor: amount,
    paid_currency: d.currency,
    provider_status: Number(d.status_code),
  });
  if (failure) throw failure;
  return data as string;
}
