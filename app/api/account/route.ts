import { currentUser } from "@/lib/auth/session";
import { errorResponse, HttpError, jsonResponse } from "@/lib/http";

export async function GET() {
  try {
    const user = await currentUser();
    if (!user) throw new HttpError(401,"Sign in to access your account.");
    return jsonResponse({ user: { id:user.id,email:user.email } });
  } catch(e) { return errorResponse(e); }
}
