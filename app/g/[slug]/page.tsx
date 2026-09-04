import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Header from "@/components/Header";
import GroupPreview from "@/components/GroupPreview";
import GroupActions from "@/components/GroupActions";
import { getGroupBySlug, incrementGroupViews } from "@/lib/groups";
import { activeBrand } from "@/lib/brand";
import { buildGroupVcard, groupFileBase } from "@/lib/vcard";
import { qrDataUrl } from "@/lib/qr";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const group = await getGroupBySlug(params.slug).catch(() => null);
  if (!group) return { title: "Group not found" };
  return {
    title: `${group.data.name} · ${activeBrand.name}`,
    description: `${group.data.members.length} contacts · ${activeBrand.name}`,
  };
}

export default async function PublicGroupPage({ params }: { params: { slug: string } }) {
  const group = await getGroupBySlug(params.slug);
  if (!group) notFound();

  await incrementGroupViews(params.slug);

  const vcard = buildGroupVcard(group.data);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const publicUrl = `${siteUrl}/g/${params.slug}`;
  const qr = await qrDataUrl(publicUrl, { width: 512 });

  return (
    <>
      <Header brand={activeBrand} />
      <main className="max-w-[560px] mx-auto px-5 pb-16 flex flex-col gap-4 items-center">
        <div
          className="w-full rounded-2xl border p-6 grid place-items-center"
          style={{ background: "var(--surface)", borderColor: "var(--line)" }}
        >
          <div className="cs-print">
            <GroupPreview data={group.data} qrUrl={qr} brand={activeBrand} />
          </div>
        </div>

        <GroupActions
          vcard={vcard}
          qrUrl={qr}
          fileBase={groupFileBase(group.data)}
          memberCount={group.data.members.length}
        />

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
