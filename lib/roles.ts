import type { User } from "@supabase/supabase-js";

// Use only with a user verified by auth.getUser(). User metadata is editable.
export function isAdministrator(user: Pick<User, "app_metadata" | "is_anonymous"> | null) {
  return !!user && !user.is_anonymous && user.app_metadata.card_studio_role === "admin";
}
