import { ownedQr, requireQrUser } from "@/lib/qr-studio/server";
import { renderOwnedQr } from "@/lib/qr-studio/export";
import { errorResponse } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export const runtime = "nodejs";
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const user = await requireQrUser();
    await rateLimit(user.id, "qr-export", 30);
    const q = await ownedQr((await params).slug, user.id);
    const p = new URL(req.url).searchParams;
    const svg = p.get("format") === "svg";
    const { output, filename } = await renderOwnedQr(user.id, q, { svg, card: p.get("layout") !== "plain" });
    return new Response(svg ? output.svg : new Uint8Array(output.png), {
      headers: {
        "Content-Type": svg ? "image/svg+xml" : "image/png",
        "Content-Disposition": `${p.has("preview") ? "inline" : "attachment"}; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
