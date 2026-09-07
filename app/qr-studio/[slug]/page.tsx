import { notFound, redirect } from "next/navigation";
import Header from "@/components/Header";
import Builder from "@/components/qr-studio/Builder";
import { currentUser } from "@/lib/auth/session";
import { ownedQr, qrFeatures } from "@/lib/qr-studio/server";
import { qrDraftSchema } from "@/lib/qr-studio/schema";
import { activeBrand } from "@/lib/brand";
import "@/components/qr-studio/qr-studio.css";
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/sign-in?next=/dashboard/qr");
  const q = await ownedQr((await params).slug, user.id);
  if (!q || !qrDraftSchema.safeParse(q.data).success) notFound();
  if (q.deleted_at || q.archived_at) redirect("/dashboard/qr");
  return (
    <>
      <Header brand={activeBrand} />
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
