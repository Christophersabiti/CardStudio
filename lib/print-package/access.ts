import "server-only";
import { createAdminClient } from "../supabase/server";
import { hasPrintPackage } from "./policy";

/** Trials inherit the effective plan; no role or client flag bypasses this check. */
export async function printAccess(ownerId: string) {
  const { data, error } = await createAdminClient().rpc("effective_plan", { account_id: ownerId });
  if (error || !data?.code) throw Error("Plan verification unavailable");
  return { allowed: hasPrintPackage(data.code), plan: data.name as string };
}
