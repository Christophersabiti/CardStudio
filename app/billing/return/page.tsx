import Link from "next/link";
import { redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { reconcilePayment } from "@/lib/billing/pesapal";
export default async function Return({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const u = await currentUser();
  if (!u) redirect("/sign-in?next=/billing");
  const p = await searchParams;
  let status =
    "Your payment is awaiting verification. Check your billing history shortly.";
  if (
    z.uuid().safeParse(p.OrderTrackingId).success &&
    z.uuid().safeParse(p.OrderMerchantReference).success
  ) {
    const { data } = await createAdminClient()
      .from("billing_orders")
      .select("id")
      .eq("id", p.OrderMerchantReference)
      .eq("owner_id", u.id)
      .maybeSingle();
    if (data) {
      try {
        const result = await reconcilePayment(
          p.OrderTrackingId,
          p.OrderMerchantReference,
        );
        status = ["paid", "already_paid"].includes(result)
          ? "Payment verified. Your plan is active."
          : result === "review_required"
            ? "Payment received and queued for review. Please contact support with your order reference."
            : "Payment has not been completed. Check your billing history before trying again.";
      } catch {}
    }
  }
  return (
    <main className="max-w-xl mx-auto p-8">
      <h1 className="text-3xl mb-5">Payment status</h1>
      <p role="status">{status}</p>
      <Link href="/billing" className="cs-button inline-block mt-6">
        Go to billing
      </Link>
    </main>
  );
}
