import { publicQr, trackQr } from "@/lib/qr-studio/server";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; index: string }> },
) {
  const p = await params;
  const qr = await publicQr(p.slug);
  const link = /^\d{1,2}$/.test(p.index)
    ? qr?.data.links[Number(p.index)]
    : null;
  if (!qr || !link) return new Response("Link unavailable", { status: 404 });
  await trackQr(qr.id, qr.owner_id, "clicks", req);
  return new Response(null, {
    status: 302,
    headers: {
      Location: link.url,
      "Cache-Control": "private, no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
