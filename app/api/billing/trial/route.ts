import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u) throw new HttpError(401, "Sign in to continue.");
    if(u.appRole==="superadmin")throw new HttpError(409,"Superadmin has unlimited access and does not need a subscription or trial.");
    await rateLimit(u.id, "trial", 3, 60);
    const { data, error } = await createAdminClient().rpc(
      "start_account_trial",
      { account_id: u.id },
    );
    if (error) throw error;
    return jsonResponse({ trial: data });
  } catch (e) {
    return errorResponse(e);
  }
}
