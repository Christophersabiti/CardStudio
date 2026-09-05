import { recordEndpoint } from "@/lib/records";
export const runtime = "nodejs";
export async function PATCH(req: Request, {params}: {params: Promise<{slug:string}>}) {
  return recordEndpoint(req,"groups",(await params).slug);
}
