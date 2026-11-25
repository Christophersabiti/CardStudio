import { notFound, redirect } from "next/navigation";
import SiteHeader from "@/components/nav/SiteHeader";
import Builder from "@/components/qr-studio/Builder";
import { currentUser } from "@/lib/auth/session";
import { touchAsset } from "@/lib/assets";
import { ownedQr, qrFeatures } from "@/lib/qr-studio/server";
import { qrDraftSchema } from "@/lib/qr-studio/schema";
import "@/components/qr-studio/qr-studio.css";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/designs");
  const q = await ownedQr((await params).slug, user.id);
  if (!q || !qrDraftSchema.safeParse(q.data).success) notFound();
  if (q.deleted_at) redirect("/designs?section=trash");
  // Archived codes are unarchived from the QR statistics page.
  if (q.archived_at) redirect("/dashboard/qr?state=archived");
  await touchAsset(user.id, "qr", q.id);
  return (
    <>
      <SiteHeader />
      <main>
        <Builder
          key={q.id}
          initial={q}
          ownerId={user.id}
          features={await qrFeatures(user.id)}
        />
      </main>
    </>
  );
}
