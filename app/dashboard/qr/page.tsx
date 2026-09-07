import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import Collection from "@/components/qr-studio/Collection";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { qrFeatures } from "@/lib/qr-studio/server";
import { activeBrand } from "@/lib/brand";
import { type QrRecord } from "@/lib/qr-studio/schema";
import "@/components/qr-studio/qr-studio.css";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; page?: string }>;
}) {
  const u = await currentUser();
  if (!u) redirect("/sign-in?next=/dashboard/qr");
  const p = await searchParams;
  const state = ["active", "archived", "trash"].includes(p.state || "")
      ? p.state!
      : "active",
    page = Math.max(1, Math.min(10000, parseInt(p.page || "1") || 1));
  const c = createAdminClient();
  let query = c
    .from("qr_codes")
    .select("*", { count: "exact" })
    .eq("owner_id", u.id)
    .eq("data->>version", "1")
    .in("type", ["event", "location", "links", "image", "video", "url"])
    .order("created_at", { ascending: false });
  query =
    state === "trash"
      ? query.not("deleted_at", "is", null)
      : state === "archived"
        ? query.is("deleted_at", null).not("archived_at", "is", null)
        : query.is("deleted_at", null).is("archived_at", null);
  const r = await query.range((page - 1) * 24, page * 24 - 1);
  if (r.error)
    throw Error("QR collection unavailable. Verify the QR Studio migration.");
  const metrics: Record<string, { opens: number; clicks: number }> = {};
  if ((await qrFeatures(u.id)).analytics && r.data.length) {
    const stats = await c
      .from("qr_metrics")
      .select("qr_id,opens,clicks")
      .in(
        "qr_id",
        r.data.map((q) => q.id),
      )
      .gte(
        "day",
        new Date(new Date().getTime() - 90 * 86400000)
          .toISOString()
          .slice(0, 10),
      );
    if (!stats.error) {
      for (const q of r.data) metrics[q.id] = { opens: 0, clicks: 0 };
      for (const m of stats.data) {
        metrics[m.qr_id].opens += Number(m.opens);
        metrics[m.qr_id].clicks += Number(m.clicks);
      }
    }
  }
  return (
    <>
      <Header brand={activeBrand} />
      <main className="qr-workspace">
        <div className="qr-studio-heading">
          <div>
            <p className="qr-eyebrow">Your collection</p>
            <h1>My QR codes.</h1>
            <p className="qr-muted">Keep the code. Update what it opens.</p>
          </div>
          <Link className="cs-button cs-primary" href="/qr-studio">
            Create QR ↗
          </Link>
        </div>
        <nav className="qr-inline">
          {["active", "archived", "trash"].map((s) => (
            <Link
              className="cs-button"
              aria-current={state === s ? "page" : undefined}
              key={s}
              href={`/dashboard/qr?state=${s}`}
            >
              {s[0].toUpperCase() + s.slice(1)}
            </Link>
          ))}
          <Link href="/dashboard">Contact cards ↗</Link>
        </nav>
        <Collection items={r.data as QrRecord[]} metrics={metrics} />
        <nav className="qr-inline">
          {page > 1 && (
            <Link href={`/dashboard/qr?state=${state}&page=${page - 1}`}>
              Previous
            </Link>
          )}
          {(r.count || 0) > page * 24 && (
            <Link href={`/dashboard/qr?state=${state}&page=${page + 1}`}>
              Next
            </Link>
          )}
        </nav>
      </main>
    </>
  );
}
