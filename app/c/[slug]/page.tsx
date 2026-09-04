import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import CardPreview from "@/components/CardPreview";
import CardActions from "@/components/CardActions";
import { getCardBySlug, incrementViews } from "@/lib/cards";
import { activeBrand } from "@/lib/brand";
import { buildVcard, contactFileBase } from "@/lib/vcard";
import { qrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const card = await getCardBySlug(params.slug).catch(() => null);
  if (!card) return { title: "Card not found" };
  const d = card.data;
  const name = `${d.firstName} ${d.lastName}`.trim() || d.organization || "Digital business card";
  return {
    title: `${name} · ${activeBrand.name}`,
    description: d.title || d.tagline || undefined,
  };
}

export default async function PublicCardPage({ params }: { params: { slug: string } }) {
  const card = await getCardBySlug(params.slug);
  if (!card) notFound();

  await incrementViews(params.slug);

  const vcard = buildVcard(card.data);
  const qr = await qrDataUrl(vcard, { width: 512 });

  return (
    <>
      <Header brand={activeBrand} />
      <main className="max-w-[560px] mx-auto px-5 pb-16 flex flex-col gap-4 items-center">
        <div
          className="w-full rounded-2xl border p-6 grid place-items-center"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <div className="cs-print">
            <CardPreview data={card.data} qrUrl={qr} brand={activeBrand} />
          </div>
        </div>

        <CardActions vcard={vcard} qrUrl={qr} fileBase={contactFileBase(card.data)} />

        <Link
          href="/"
          className="text-sm font-semibold mt-2"
          style={{ color: "var(--brand-primary-deep)" }}
        >
          Create your own card →
        </Link>
      </main>
    </>
  );
}
