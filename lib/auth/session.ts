import "server-only";
import { cache } from "react";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { createAdminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import { isClerkConfigured } from "./config";

export interface SessionUser {
  /** Internal application UUID, retained for migrated owners. */
  id: string;
  clerkId: string;
  email: string;
  appRole: "member" | "admin" | "superadmin";
  status: "active";
}

/** Per-request memoization only. Never cache identity across users/requests. */
export const currentUser = cache(async (): Promise<SessionUser | null> => {
  if (!isClerkConfigured()) return null;
  const identity = await auth();
  if (!identity.userId || !identity.sessionId) return null;
  const clerk = await clerkClient();
  // Live status closes the revoked-token window for application requests.
  // Outages fail closed; old Supabase cookies never grant fallback access.
  const [session, user] = await Promise.all([
    clerk.sessions.getSession(identity.sessionId),
    clerk.users.getUser(identity.userId),
  ]);
  if (session.status !== "active" || session.userId !== identity.userId || user.banned || user.locked) {
    throw new HttpError(403, "This account or session is unavailable. Please sign in again.");
  }
  const email = user.emailAddresses.find(e => e.id === user.primaryEmailAddressId && e.verification?.status === "verified");
  if (!email) throw new HttpError(403, "Verify your email address before saving cards.");
  const { data: account, error } = await createAdminClient().rpc("ensure_clerk_user", {
    verified_clerk_id: identity.userId,
    display_name: [user.firstName, user.lastName].filter(Boolean).join(" "),
  });
  if (error?.code === "42501") throw new HttpError(403, "This CardStudio account is unavailable. Contact support.");
  if (error || !account?.id) throw new Error("Account provisioning unavailable. Verify the database migrations.");
  if (account.status !== "active" || account.clerk_disabled || account.clerk_user_id !== identity.userId) {
    throw new HttpError(403, "This CardStudio account is unavailable. Contact support.");
  }
  return { id: account.id, clerkId: identity.userId, email: email.emailAddress, appRole: account.app_role, status: "active" };
});
