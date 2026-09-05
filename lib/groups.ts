import "server-only";
import { createAdminClient } from "./supabase/server";
import type { GroupRecord } from "./types";

const TABLE = "groups";

/** Fetch one group by slug. Returns null if not found. */
export async function getGroupBySlug(slug: string): Promise<Pick<GroupRecord, "id" | "slug" | "data" | "created_at" | "view_count"> | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, slug, published_data, created_at, view_count")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? { id: data.id, slug: data.slug, data: data.published_data, created_at: data.created_at, view_count: data.view_count } : null;
}

/** Best-effort view counter. Never throws into the render path. */
export async function incrementGroupViews(slug: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.rpc("increment_group_views", { group_slug: slug });
  } catch {
    // ignore — view counting is not critical
  }
}
