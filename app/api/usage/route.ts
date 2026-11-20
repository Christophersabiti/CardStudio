import { currentUser } from "@/lib/auth/session";
import { accountSummary } from "@/lib/billing/account-summary";
import { errorResponse, jsonResponse } from "@/lib/http";

export async function GET() {
  try {
    const u = await currentUser();
    if (!u) return jsonResponse({}, 401);
    return jsonResponse(await accountSummary(u));
  } catch (e) {
    return errorResponse(e);
  }
}
