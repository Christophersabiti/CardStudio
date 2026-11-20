import Link from "next/link";
import type { Metadata } from "next";
import Shell from "@/components/marketing/Shell";
import ProductIcon from "@/components/nav/ProductIcon";
import { ArrowUpRightIcon } from "@/components/icons";
import { productFeature, products } from "@/lib/navigation";
import { featureFlags } from "@/lib/features";

export const metadata: Metadata = { title: "Create · Card Studio", description: "Choose what to make: a business card, QR code, team contacts, email signature, e-stamp or print package." };

export const dynamic = "force-dynamic";

export default async function CreatePage() {
  const flags = await featureFlags();
  const available = products.filter((p) => flags[productFeature[p.key]]);
  return (
    <Shell>
      <main id="main-content" className="mk-detail mk-create">
        <p className="mk-eyebrow">Start here</p>
        <h1>What would you like to make?</h1>
        <p className="mk-lead">Pick one to open its editor. You can start without an account and sign in when you want to save or publish.</p>
        <ul className="mk-create-grid">
          {available.map((p) => (
            <li key={p.key}>
              <ProductIcon product={p.key} />
              <h2>{p.title}</h2>
              <p>{p.summary}</p>
              {p.needsAccount && <p className="mk-create-note">Needs a free account.</p>}
              <div className="mk-create-actions">
                <Link className="mk-button" href={p.href}>
                  Start <ArrowUpRightIcon />
                </Link>
                {p.learnMore && <Link className="mk-text-link" href={p.learnMore}>How it works</Link>}
              </div>
            </li>
          ))}
        </ul>
      </main>
    </Shell>
  );
}
