import "server-only";
import { publicOwnerActive } from "./public-access";
import { createAdminClient } from "./supabase/server";
import type { CardRecord, GroupRecord, RecordKind } from "./types";

type Published<R extends CardRecord | GroupRecord> = Pick<R, "id" | "slug" | "data" | "created_at" | "view_count">;

/** Public pages read only the published snapshot of a live record with an active owner. */
export async function getPublishedBySlug<R extends CardRecord | GroupRecord>(kind: RecordKind, slug: string): Promise<Published<R> | null> {
  const { data, error } = await createAdminClient()
    .from(kind)
    .select("id, slug, owner_id, published_data, created_at, view_count")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data || !(await publicOwnerActive(data.owner_id))) return null;
  return { id: data.id, slug: data.slug, data: data.published_data, created_at: data.created_at, view_count: data.view_count } as Published<R>;
}

/** Best-effort view counter. Never throws into the render path. */
export async function incrementPublishedViews(kind: RecordKind, slug: string): Promise<void> {
  try {
    const client = createAdminClient();
    if (kind === "cards") await client.rpc("increment_card_views", { card_slug: slug });
    else await client.rpc("increment_group_views", { group_slug: slug });
  } catch {
    // ignore — view counting is not critical
  }
}
