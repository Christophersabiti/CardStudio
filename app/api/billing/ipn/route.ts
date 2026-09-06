import { z } from "zod";
import { reconcilePayment } from "@/lib/billing/pesapal";
import { errorResponse, jsonResponse, readJson } from "@/lib/http";
const schema = z.object({
  OrderTrackingId: z.uuid(),
  OrderMerchantReference: z.uuid(),
  OrderNotificationType: z.literal("IPNCHANGE"),
});
async function receive(req: Request) {
  try {
    const b = schema.parse(
      req.method === "GET"
        ? Object.fromEntries(new URL(req.url).searchParams)
        : await readJson(req, 4096),
    );
    await reconcilePayment(b.OrderTrackingId, b.OrderMerchantReference);
    return jsonResponse({
      orderNotificationType: "IPNCHANGE",
      orderTrackingId: b.OrderTrackingId,
      orderMerchantReference: b.OrderMerchantReference,
      status: 200,
    });
  } catch (e) {
    return errorResponse(e);
  }
}
export const GET = receive;
export const POST = receive;
