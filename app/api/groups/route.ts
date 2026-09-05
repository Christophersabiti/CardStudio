import { recordEndpoint } from "@/lib/records";
export const runtime = "nodejs";
export async function POST(req: Request) { return recordEndpoint(req,"groups"); }
