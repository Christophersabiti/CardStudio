import "server-only";
import { createAdminClient } from "../supabase/server";
import { hasPrintPackage } from "./policy";
import { isSuperAdministrator } from "../roles";
import type { SessionUser } from "../auth/session";

/** Only the server-verified active super admin bypasses billing, not ownership. */
export async function printAccess(user: Pick<SessionUser, "id" | "appRole" | "status">) {
  if (isSuperAdministrator(user)) return { allowed: true, plan: "Superadmin" };
  const { data, error } = await createAdminClient().rpc("effective_plan", { account_id: user.id });
  if (error || !data?.code) throw Error("Plan verification unavailable");
  return { allowed: hasPrintPackage(data.code), plan: data.name as string };
}
