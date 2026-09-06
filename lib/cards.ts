import "server-only";
import { publicOwnerActive } from "./public-access";
import { createAdminClient } from "./supabase/server";
import type { CardRecord } from "./types";

const TABLE = "cards";

/** Fetch one card by slug. Returns null if not found. */
export async function getCardBySlug(slug: string): Promise<Pick<CardRecord, "id" | "slug" | "data" | "created_at" | "view_count"> | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABLE)
    .select("id, slug, owner_id, published_data, created_at, view_count")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if(data && !(await publicOwnerActive(data.owner_id)))return null;
  return data ? { id: data.id, slug: data.slug, data: data.published_data, created_at: data.created_at, view_count: data.view_count } : null;
}

/** Best-effort view counter. Never throws into the render path. */
export async function incrementViews(slug: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase.rpc("increment_card_views", { card_slug: slug });
  } catch {
    // ignore — view counting is not critical
  }
}
