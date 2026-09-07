import { qrEndpoint } from "@/lib/qr-studio/server";
export const POST = (req: Request) => qrEndpoint(req);
