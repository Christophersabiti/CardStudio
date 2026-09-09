import { currentUser } from "@/lib/auth/session";
import { printAccess } from "@/lib/print-package/access";
import { errorResponse, jsonResponse } from "@/lib/http";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonResponse({ allowed: false }, 401);
    return jsonResponse(await printAccess(user));
  } catch (error) { return errorResponse(error); }
}
