import { qrEndpoint } from "@/lib/qr-studio/server";
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  return qrEndpoint(req, (await params).slug);
}
