import "server-only";
import { createAdminClient } from "./supabase/server";
import { HttpError } from "./http";
import type { AssetAction, AssetKind, AssetPage, AssetSection, AssetSort } from "./assets-schema";

/**
 * Server-side library operations. Every function takes the verified owner ID from
 * requireUser(); none trust IDs or names from the client for ownership.
 */
const SOURCE: Record<AssetKind, { table: string; nameColumn?: string; content: string }> = {
  card: { table: "cards", content: "data" },
  group: { table: "groups", content: "data" },
  qr: { table: "qr_codes", content: "data" },
  stamp: { table: "stamp_designs", nameColumn: "name", content: "design" },
  signature: { table: "signature_designs", nameColumn: "name", content: "design" },
  print: { table: "print_packages", nameColumn: "name", content: "config" },
};
/** Kinds whose lifecycle (Trash, restore, duplicate) is handled here rather than by a product endpoint. */
export const LIBRARY_LIFECYCLE: AssetKind[] = ["stamp", "signature", "print"];

export async function listAssets(owner: string, p: { kind: AssetKind | ""; q: string; section: AssetSection; sort: AssetSort; page: number }): Promise<AssetPage> {
  const { data, error } = await createAdminClient().rpc("list_design_assets", { account_id: owner, kind_filter: p.kind, query: p.q, section: p.section, sort: p.sort, page_number: p.page });
  if (error) throw error;
  return data as AssetPage;
}

async function ownedSource(owner: string, kind: AssetKind, id: string) {
  const s = SOURCE[kind];
  const { data, error } = await createAdminClient().from(s.table).select(`id,${s.content},deleted_at${s.nameColumn ? `,${s.nameColumn}` : ""}`).eq("id", id).eq("owner_id", owner).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Design not found.");
  return data as unknown as Record<string, unknown> & { id: string; deleted_at: string | null };
}

async function upsertMeta(owner: string, kind: AssetKind, id: string, patch: { name?: string | null; favorite?: boolean; last_opened_at?: string }) {
  const { error } = await createAdminClient().from("design_assets").upsert({ owner_id: owner, kind, source_id: id, ...patch }, { onConflict: "owner_id,kind,source_id" });
  if (error) throw error;
}

/** Appends " (2)", " (3)" … when the owner already has a live design of this kind with the same name. */
export async function uniqueDesignName(owner: string, kind: "stamp" | "signature" | "print", name: string, exceptId?: string) {
  const s = SOURCE[kind];
  // stamp_designs.name (and the stamp's own title) allow 64 characters; the others 120.
  const base = name.trim().slice(0, kind === "stamp" ? 56 : 112);
  let q = createAdminClient().from(s.table).select(`${s.nameColumn}`).eq("owner_id", owner).is("deleted_at", null).ilike(s.nameColumn!, `${base.replace(/[\\%_]/g, (c) => `\\${c}`)}%`).limit(200);
  if (exceptId) q = q.neq("id", exceptId);
  const { data, error } = await q;
  if (error) throw error;
  const taken = new Set((data as unknown as Record<string, string>[]).map((r) => r[s.nameColumn!].toLowerCase()));
  if (!taken.has(base.toLowerCase())) return base;
  for (let i = 2; i < 500; i++) if (!taken.has(`${base} (${i})`.toLowerCase())) return `${base} (${i})`;
  return `${base} (${Date.now() % 10000})`;
}

export async function assetAction(owner: string, kind: AssetKind, id: string, body: AssetAction) {
  const c = createAdminClient();
  const s = SOURCE[kind];
  const row = await ownedSource(owner, kind, id);
  switch (body.action) {
    case "favorite": await upsertMeta(owner, kind, id, { favorite: body.favorite }); return { ok: true };
    case "opened": await upsertMeta(owner, kind, id, { last_opened_at: new Date().toISOString() }); return { ok: true };
    case "rename": {
      if (row.deleted_at) throw new HttpError(409, "Restore this design before renaming it.");
      if (kind === "stamp" && body.name.length > 64) throw new HttpError(400, "Stamp names can be up to 64 characters.");
      if (s.nameColumn) {
        const name = await uniqueDesignName(owner, kind as "stamp" | "signature" | "print", body.name, id);
        const patch: Record<string, unknown> = { [s.nameColumn]: name };
        // The stamp editor shows design.title as the design name; keep both in step.
        if (kind === "stamp") patch.design = { ...(row.design as object), title: name.slice(0, 64) };
        const { error } = await c.from(s.table).update(patch).eq("id", id).eq("owner_id", owner).is("deleted_at", null);
        if (error) throw error;
        await upsertMeta(owner, kind, id, { name: null });
        return { ok: true, name };
      }
      await upsertMeta(owner, kind, id, { name: body.name });
      return { ok: true, name: body.name };
    }
    case "trash":
    case "restore": {
      if (!LIBRARY_LIFECYCLE.includes(kind)) throw new HttpError(400, "Use this design's own editor for that action.");
      const { error } = await c.from(s.table).update({ deleted_at: body.action === "trash" ? new Date().toISOString() : null }).eq("id", id).eq("owner_id", owner);
      if (error) throw error;
      return { ok: true };
    }
    case "duplicate": {
      if (!LIBRARY_LIFECYCLE.includes(kind)) throw new HttpError(400, "Use this design's own editor for that action.");
      if (row.deleted_at) throw new HttpError(409, "Restore this design before duplicating it.");
      const previous = await c.from(s.table).select("id,name").eq("id", body.id).eq("owner_id", owner).maybeSingle();
      if (previous.error) throw previous.error;
      if (previous.data) return { ok: true, id: previous.data.id, name: previous.data.name }; // Idempotent retry.
      const name = await uniqueDesignName(owner, kind as "stamp" | "signature" | "print", `${String(row[s.nameColumn!])} copy`);
      const content = kind === "stamp" ? { ...(row.design as object), title: name.slice(0, 64) } : row[s.content];
      const { error } = await c.from(s.table).insert({ id: body.id, owner_id: owner, name, [s.content]: content });
      if (error?.code === "23505") return { ok: true, id: body.id, name };
      if (error) throw error;
      return { ok: true, id: body.id, name };
    }
  }
}

/** Records that the owner opened a design, for the Recent view. Never fails the caller. */
export async function touchAsset(owner: string, kind: AssetKind, id: string) {
  try { await upsertMeta(owner, kind, id, { last_opened_at: new Date().toISOString() }); } catch { /* Recent is best-effort */ }
}

/**
 * Create or update a signature or print package. Creation is idempotent on the
 * client-generated ID; updates require the current revision to prevent lost edits.
 */
export async function saveLibraryDesign(owner: string, kind: "signature" | "print", body: { id?: string; revision?: number; name: string; content: unknown }) {
  const c = createAdminClient();
  const s = SOURCE[kind];
  const columns = `id,name,${s.content},revision,created_at,updated_at`;
  if (!body.id) throw new HttpError(400, "Missing request ID.");
  const existing = await c.from(s.table).select("id,revision,deleted_at").eq("id", body.id).eq("owner_id", owner).maybeSingle();
  if (existing.error) throw existing.error;
  if (!existing.data) {
    const name = await uniqueDesignName(owner, kind, body.name);
    const created = await c.from(s.table).insert({ id: body.id, owner_id: owner, name, [s.content]: body.content }).select(columns).single();
    if (created.error?.code === "23505") {
      const retry = await c.from(s.table).select(columns).eq("id", body.id).eq("owner_id", owner).single();
      if (retry.error) throw new HttpError(409, "That ID is already in use. Reload and try again.");
      return { design: retry.data, created: false };
    }
    if (created.error) throw created.error;
    return { design: created.data, created: true };
  }
  if (existing.data.deleted_at) throw new HttpError(409, "Restore this design from Trash before editing it.");
  if (body.revision !== existing.data.revision) throw new HttpError(409, "This design changed in another tab. Reload before saving.");
  const name = await uniqueDesignName(owner, kind, body.name, body.id);
  const updated = await c.from(s.table).update({ name, [s.content]: body.content }).eq("id", body.id).eq("owner_id", owner).eq("revision", body.revision).select(columns).maybeSingle();
  if (updated.error) throw updated.error;
  if (!updated.data) throw new HttpError(409, "This design changed in another tab. Reload before saving.");
  return { design: updated.data, created: false };
}

export async function getLibraryDesign(owner: string, kind: "signature" | "print", id: string) {
  const s = SOURCE[kind];
  const { data, error } = await createAdminClient().from(s.table).select(`id,name,${s.content},revision,created_at,updated_at`).eq("id", id).eq("owner_id", owner).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Design not found.");
  return data;
}
