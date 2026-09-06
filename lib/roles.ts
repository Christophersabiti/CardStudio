import type { SessionUser } from "./auth/session";

// Only a server-resolved internal account supplies this role.
export function isAdministrator(user: Pick<SessionUser, "appRole" | "status"> | null) {
  return user?.status === "active" && user.appRole === "admin";
}
