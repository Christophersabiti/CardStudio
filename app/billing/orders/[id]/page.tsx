/* eslint-disable react-hooks/purity -- Request-time server rendering of expiry dates; no client render clock. */
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { money } from "@/lib/billing/catalog";
export default async function Order({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect("/sign-in");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const c = createAdminClient();
  const { data: o, error } = await c
    .from("billing_orders")
    .select("*")
    .eq("id", id)
    .eq("owner_id", u.id)
    .maybeSingle();
  if (error) throw error;
  if (!o) notFound();
  const { data: s } = await c
    .from("checkout_sessions")
    .select("redirect_url")
    .eq("order_id", o.id)
    .maybeSingle();
  return (
    <main className="max-w-xl mx-auto px-5 py-12">
      <h1 className="text-3xl mb-5">Order details</h1>
      <div className="cs-panel">
        <p className="break-all">Reference: {o.id}</p>
        <p className="mt-3">Amount: {money(o)}</p>
        <p className="my-3">Status: {o.status}</p>
        {o.status === "pending" &&
          Date.parse(o.expires_at) > Date.now() &&
          s && (
            <a
              className="cs-button cs-primary inline-block"
              href={s.redirect_url}
            >
              Continue to Pesapal
            </a>
          )}
        <p className="cs-muted text-sm mt-4">
          Only a verified payment activates your plan. If you paid but this
          status has not updated, contact support with this reference. Do not
          pay twice.
        </p>
      </div>
      <Link href="/billing" className="cs-button inline-block mt-5">
        Back to billing
      </Link>
    </main>
  );
}
