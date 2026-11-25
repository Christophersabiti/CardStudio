"use client";
import Link from "next/link";
import type { Brand } from "@/lib/brand";
import { assetEditHref, type AssetItem } from "@/lib/assets-schema";
import { AssetArt } from "./art";
import { KindIcon, kindInfo } from "./Library";
import "./designs.css";

const ago = (iso: string) => {
  const d = Math.round((Date.now() - Date.parse(iso)) / 86_400_000);
  return d < 1 ? "today" : d === 1 ? "yesterday" : d < 14 ? `${d} days ago` : new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

/** Dashboard strip: the latest designs across every product, one click from their editor. */
export default function RecentDesigns({ items, total, brand }: { items: AssetItem[]; total: number; brand: Brand }) {
  if (!items.length)
    return <div className="ds-app ds-recent-empty"><p>Nothing saved yet. Pick a product above to make your first design. It will appear here and in My designs.</p></div>;
  return (
    <div className="ds-app ds-recent">
      <div className="ds-grid">
        {items.map((a) => (
          <article key={`${a.kind}:${a.id}`} className="ds-card" data-kind={a.kind}>
            <div className="ds-thumb">
              <div className="ds-thumb-art" inert><AssetArt asset={a} brand={brand} /></div>
              <Link className="ds-thumb-hit" href={assetEditHref(a)} aria-label={`Edit ${a.name}`} />
              <span className="ds-type"><KindIcon kind={a.kind} size={11} />{kindInfo(a.kind).label}</span>
            </div>
            <div className="ds-card-body">
              <Link className="ds-name" href={assetEditHref(a)}>{a.name}</Link>
              <p className="ds-when" suppressHydrationWarning>Edited {ago(a.updatedAt)}</p>
            </div>
          </article>
        ))}
      </div>
      {total > items.length && <p className="ds-recent-more"><Link className="ds-link" href="/designs">See all {total} designs →</Link></p>}
    </div>
  );
}
