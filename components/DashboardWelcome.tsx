"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import type { Product } from "@/lib/navigation";
import ProductIcon from "@/components/nav/ProductIcon";

export type RecentQr = { slug: string; title: string; type: string; published: boolean; updated_at: string };
export type RecentStamp = { id: string; name: string; updated_at: string };

const when = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Top of the signed-in home: greeting, one-tap create tiles and recent QR codes and stamps. */
export default function DashboardWelcome({ products, qr, stamps }: { products: Product[]; qr: RecentQr[]; stamps: RecentStamp[] }) {
  const { user } = useUser();
  const first = user?.firstName?.trim();
  const showQr = products.some((p) => p.key === "qr");
  const showStamps = products.some((p) => p.key === "stamp");
  return (
    <section className="dw" aria-labelledby="dw-heading">
      <h1 id="dw-heading" className="text-3xl font-bold">{first ? `Welcome back, ${first}` : "Welcome back"}</h1>
      <p className="cs-muted mt-2">What would you like to make today?</p>
      <ul className="dw-create">
        {products.map((p) => (
          <li key={p.key}>
            <Link href={p.href} className="dw-tile">
              <ProductIcon product={p.key} />
              <span>{p.title}</span>
            </Link>
          </li>
        ))}
      </ul>
      {(showQr || showStamps) && (
        <div className="dw-recent">
          {showQr && (
            <div className="cs-panel">
              <div className="dw-recent-head">
                <h2 className="font-bold">Recent QR codes</h2>
                <Link href="/designs?kind=qr" className="text-sm underline">See all</Link>
              </div>
              {qr.length ? (
                <ul className="dw-list">
                  {qr.map((q) => (
                    <li key={q.slug}>
                      <Link href={`/qr-studio/${q.slug}`}>
                        <strong>{q.title || "Untitled QR code"}</strong>
                        <small>{q.published ? "Published" : "Private draft"} · {q.type} · {when(q.updated_at)}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm cs-muted mt-2">
                  No QR codes yet. A QR code can open an event, a map, your links, an image or a video. <Link href="/qr-studio" className="underline">Create one</Link>.
                </p>
              )}
            </div>
          )}
          {showStamps && (
            <div className="cs-panel">
              <div className="dw-recent-head">
                <h2 className="font-bold">Saved stamps</h2>
                <Link href="/designs?kind=stamp" className="text-sm underline">See all</Link>
              </div>
              {stamps.length ? (
                <ul className="dw-list">
                  {stamps.map((s) => (
                    <li key={s.id}>
                      <Link href={`/stamp-maker?design=${s.id}`}>
                        <strong>{s.name || "Untitled stamp"}</strong>
                        <small>Saved {when(s.updated_at)}</small>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm cs-muted mt-2">
                  No saved stamps yet. Design a company seal or date stamp and save it to reuse later. <Link href="/stamp-maker" className="underline">Make a stamp</Link>.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
