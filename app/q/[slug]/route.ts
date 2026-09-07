import { publicQr, trackQr } from "@/lib/qr-studio/server";
import { errorResponse } from "@/lib/http";
export const dynamic = "force-dynamic";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const qr = await publicQr((await params).slug);
    if (!qr)
      return new Response("This QR is unavailable.", {
        status: 404,
        headers: { "Cache-Control": "private, no-store" },
      });
    await trackQr(qr.id, qr.owner_id, "opens", req);
    return new Response(null, {
      status: 302,
      headers: {
        Location:
          qr.data.type === "url"
            ? qr.data.url
            : new URL(`/view/${qr.slug}`, req.url).toString(),
        "Cache-Control": "private, no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
