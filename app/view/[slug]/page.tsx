import { notFound } from "next/navigation";
import { publicQr } from "@/lib/qr-studio/server";
import Experience from "@/components/qr-studio/Experience";
import "@/components/qr-studio/qr-studio.css";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Shared with Card Studio",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const q = await publicQr((await params).slug);
  if (!q) notFound();
  return (
    <main className="qr-public">
      <Experience data={q.data} slug={q.slug} />
    </main>
  );
}
