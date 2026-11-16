import { requireUser } from "@/lib/auth/session";
import { errorResponse, jsonResponse } from "@/lib/http";

export async function GET() {
  try {
    const user = await requireUser("Sign in to access your account.");
    return jsonResponse({ user: { id:user.id,email:user.email } });
  } catch(e) { return errorResponse(e); }
}
