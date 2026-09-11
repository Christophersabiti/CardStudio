import CardFrame from "@/components/CardFrame";
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
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const card = await getCardBySlug((await params).slug).catch(() => null);
  if (!card) return { title: "Card not found" };
  const d = card.data;
  const name = `${d.firstName} ${d.lastName}`.trim() || d.organization || "Digital business card";
  return {
    robots: { index: false, follow: false },
    title: `${name} · ${activeBrand.name}`,
    description: d.title || d.tagline || undefined,
  };
}

export default async function PublicCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const card = await getCardBySlug((await params).slug);
  if (!card) notFound();

  await incrementViews((await params).slug);

  const vcard = buildVcard(card.data);
  const publicUrl = `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/c/${(await params).slug}`;
  const qr = await qrDataUrl(publicUrl, { width: 512 }).catch(() => "");

  return (
    <>
      <Header brand={activeBrand} />
      <main data-card-surface className="max-w-[560px] mx-auto px-5 pb-16 flex flex-col gap-4 items-center">
        <div
          className="w-full rounded-2xl border p-6 grid place-items-center"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <CardFrame>
            <CardPreview data={card.data} qrUrl={qr} brand={activeBrand} qrLabel="Scan to view my profile" />
          </CardFrame>
        </div>

        <CardActions
          publicCard
          data={card.data}
          vcard={vcard}
          qrUrl={qr}
          fileBase={contactFileBase(card.data)}
          firstName={card.data.firstName}
          lastName={card.data.lastName}
          qrAccent={activeBrand.colors.primary}
        />

        {!qr && <p role="alert" className="cs-error">The QR could not be generated. You can still download the contact file above.</p>}

        <Link
          href="/studio"
          className="cs-button cs-primary w-full text-center mt-2 !py-4 !text-base shadow-lg"
        >
          Create your own card →
        </Link>
      </main>
    </>
  );
}
