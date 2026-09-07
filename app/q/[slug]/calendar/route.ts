import { publicQr } from "@/lib/qr-studio/server";
import { calendar } from "@/lib/qr-studio/schema";
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const qr = await publicQr((await params).slug);
  if (!qr || qr.data.type !== "event")
    return new Response("Event unavailable", { status: 404 });
  return new Response(calendar(qr.data, qr.slug), {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="event.ics"',
      "Cache-Control": "private, no-store",
    },
  });
}
