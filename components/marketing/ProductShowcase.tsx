import Link from "next/link";
import type { Product, ProductKey } from "@/lib/navigation";
import ProductIcon from "@/components/nav/ProductIcon";
import { ArrowUpRightIcon } from "@/components/icons";

/** A decorative QR-style mark: three corner squares and a fixed scatter of modules. */
const modules = [[8,0],[10,0],[9,1],[11,2],[8,3],[10,4],[0,8],[2,8],[4,9],[1,10],[3,11],[8,8],[9,9],[11,8],[10,10],[12,11],[8,12],[10,12],[13,9],[12,13],[9,14],[14,14],[13,12],[11,14],[14,10],[8,10],[12,8]];
function QrGlyph({ size }: { size: number }) {
  const finder = (x: number, y: number) => (
    <g key={`${x}-${y}`}><rect x={x} y={y} width="7" height="7" rx="1" fill="#202421" /><rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" /><rect x={x + 2} y={y + 2} width="3" height="3" fill="#202421" /></g>
  );
  return (
    <svg className="mk-tq" viewBox="-1 -1 17 17" width={size} height={size} aria-hidden>
      <rect x="-1" y="-1" width="17" height="17" rx="2" fill="#fff" />
      {finder(0, 0)}{finder(8, 0)}{finder(0, 8)}
      {modules.filter(([x, y]) => !(x >= 8 && y <= 6) && !(x <= 6 && y >= 8)).map(([x, y]) => <rect key={`${x}.${y}`} x={x} y={y} width="1" height="1" fill="#202421" />)}
    </svg>
  );
}

/** Small drawn previews so a first-time visitor can see what each tool makes. */
function Thumb({ kind }: { kind: ProductKey }) {
  switch (kind) {
    case "card":
      return (
        <div className="mk-thumb mk-thumb-card" aria-hidden>
          <div className="mk-tc-left"><i /><b /><b /><b /></div>
          <div className="mk-tc-right"><QrGlyph size={46} /></div>
        </div>
      );
    case "qr":
      return (
        <div className="mk-thumb mk-thumb-qr" aria-hidden>
          <QrGlyph size={78} />
          <div className="mk-tqr-caption"><b /><b /></div>
        </div>
      );
    case "group":
      return (
        <div className="mk-thumb mk-thumb-group" aria-hidden>
          {["AN", "JK", "RM", "SO"].map((n) => <span key={n}>{n}</span>)}
          <div className="mk-tg-lines"><b /><b /></div>
        </div>
      );
    case "signature":
      return (
        <div className="mk-thumb mk-thumb-sig" aria-hidden>
          <div className="mk-ts-bar" />
          <div className="mk-ts-body"><b /><b /><b /></div>
          <div className="mk-ts-sig"><i /><div><strong>Alex Morgan</strong><small>Creative Director</small></div></div>
        </div>
      );
    case "stamp":
      return (
        <div className="mk-thumb mk-thumb-stamp" aria-hidden>
          <span><small>YOUR COMPANY</small><strong>APPROVED</strong><small>20 NOV 2026</small></span>
        </div>
      );
    case "print":
      return (
        <div className="mk-thumb mk-thumb-print" aria-hidden>
          <span /><span /><span />
        </div>
      );
  }
}

export default function ProductShowcase({ items }: { items: Product[] }) {
  return (
    <section className="mk-section mk-showcase" id="make" aria-labelledby="make-heading">
      <div className="mk-section-heading">
        <div>
          <p className="mk-eyebrow">Start here</p>
          <h2 id="make-heading">What do you want to make?</h2>
        </div>
        <p className="mk-showcase-note">Pick one to open its editor. You can try every tool before you sign in.</p>
      </div>
      <ul className="mk-showcase-grid">
        {items.map((p) => (
          <li key={p.key}>
            <Link href={p.href} className="mk-showcase-tile">
              <Thumb kind={p.key} />
              <span className="mk-showcase-text">
                <span className="mk-showcase-title"><ProductIcon product={p.key} /> <strong>{p.title}</strong></span>
                <small>{p.summary}</small>
                <span className="mk-showcase-start">
                  {p.needsAccount ? "Start (free account)" : "Start"} <ArrowUpRightIcon />
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="mk-plan-teaser">
        <div>
          <strong>Start free. Upgrade when you need more.</strong>
          <p>Create and publish on the Free plan. Basic and Premium add more cards and QR codes, custom colours, logos in QR codes and print packages.</p>
        </div>
        <Link href="/pricing" className="mk-text-link">Compare plans <ArrowUpRightIcon /></Link>
      </div>
    </section>
  );
}
