import { auth, clerkClient } from "@clerk/nextjs/server";
import { currentUser } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/server";
import { checkOrigin, errorResponse, jsonResponse } from "@/lib/http";
export async function GET() {
  try {
    const user = await currentUser();
    if (!user) return jsonResponse({ error: "Sign in to continue." }, 401);
    const a = await auth();
    const r = await createAdminClient().rpc("check_app_session", {
      sid: a.sessionId,
      subject: a.userId,
      touch: false,
    });
    if (r.error) throw r.error;
    return jsonResponse(r.data);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const u = await currentUser();
    if (!u) return jsonResponse({ error: "Sign in to continue." }, 401);
    const a = await auth();
    const r = await createAdminClient().rpc("check_app_session", {
      sid: a.sessionId,
      subject: a.userId,
      touch: true,
    });
    if (r.error) throw r.error;
    if (!r.data.active) return jsonResponse({ error: "Session expired" }, 401);
    return jsonResponse(r.data);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function DELETE(req: Request) {
  try {
    checkOrigin(req);
    const a = await auth();
    if (a.sessionId) {
      await createAdminClient()
        .from("app_sessions")
        .update({ expired: true })
        .eq("session_id", a.sessionId);
      await (await clerkClient()).sessions.revokeSession(a.sessionId);
    }
    return jsonResponse({ ok: true });
  } catch (e) {
    return errorResponse(e);
  }
}
