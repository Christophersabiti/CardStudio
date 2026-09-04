import "server-only";
import { createAdminClient } from "./supabase/server";
import { newSlug } from "./slug";
import type { GroupData, GroupRecord } from "./types";

const TABLE = "groups";

/** Insert a new group and return its slug. Retries once on the rare slug clash. */
export async function createGroup(data: GroupData): Promise<{ slug: string }> {
  const supabase = createAdminClient();

  for (let attempt = 0; attempt < 3; attempt++) {
    const slug = newSlug();
    const { error } = await supabase.from(TABLE).insert({ slug, data });
    if (!error) return { slug };
    // 23505 = unique_violation (slug already taken) -> try again
    if ((error as { code?: string }).code !== "23505") {
      throw new Error(error.message);
    }
  }
  throw new Error("Could not generate a unique slug, please try again.");
}

/** Fetch one group by slug. Returns null if not found. */
export async function getGroupBySlug(slug: string): Promise<GroupRecord | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, slug, data, created_at, view_count")
    .eq("slug", slug)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as GroupRecord) ?? null;
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
