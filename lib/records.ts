import "server-only";
import type { CardData, RecordKind, StudioRecord } from "./types";
import { createAdminClient } from "./supabase/server";
import { currentUser } from "./supabase/session";
import { cardSchema, groupSchema, createSchema, updateSchema, slugSchema } from "./validation";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "./http";
import { rateLimit } from "./rate-limit";
import { storeImage } from "./media";
import { newSlug } from "./slug";

export async function ownedRecord(kind: RecordKind, slug: string, ownerId: string) {
  if (!slugSchema.safeParse(slug).success) return null;
  const {data,error} = await createAdminClient().from(kind).select("*").eq("slug",slug).eq("owner_id",ownerId).maybeSingle();
  if (error) throw error;
  return data as StudioRecord | null;
}
async function normalize(kind: RecordKind, raw: unknown, ownerId: string) {
  if (kind === "groups") return groupSchema.parse(raw);
  const data = cardSchema.parse(raw) as CardData;
  data.photo = await storeImage(data.photo,ownerId);
  data.logo = await storeImage(data.logo,ownerId);
  return data;
}
function requireConsent(kind: RecordKind, consent: boolean) {
  if (kind === "groups" && !consent) throw new HttpError(400,"Confirm that you are authorized to share every member's contact details publicly.");
}
export async function recordEndpoint(req: Request, kind: RecordKind, slug?: string) {
  try {
    checkOrigin(req);
    const user = await currentUser();
    if (!user) throw new HttpError(401,"Sign in to save and manage your cards.");
    await rateLimit(user.id,"record-write",30);
    const raw = await readJson(req);
    const client = createAdminClient();
    if (!slug) {
      const body = createSchema.parse(raw);
      const previous = await client.from(kind).select("*").eq("id",body.id).eq("owner_id",user.id).maybeSingle();
      if (previous.error) throw previous.error;
      if (previous.data) return jsonResponse({record: previous.data}); // Retry without duplicate publication.
      if (body.publish) requireConsent(kind,body.consent);
      const data = await normalize(kind,body.data,user.id);
      const result = await client.from(kind).insert({id:body.id,slug:newSlug(),owner_id:user.id,data,published:body.publish,published_data:body.publish?data:null}).select("*").single();
      if (result.error?.code === "23505") {
        const retry = await client.from(kind).select("*").eq("id",body.id).eq("owner_id",user.id).maybeSingle();
        if (retry.data) return jsonResponse({record:retry.data});
      }
      if (result.error) throw result.error;
      return jsonResponse({record:result.data},201);
    }
    slugSchema.parse(slug);
    const body = updateSchema.parse(raw);
    const record = await ownedRecord(kind,slug,user.id);
    if (!record) throw new HttpError(404,"Card not found.");
    if (record.revision !== body.revision) throw new HttpError(409,"This card changed in another tab. Reload before saving to avoid overwriting it.");
    if (body.action === "duplicate") {
      if (!body.id) throw new HttpError(400,"Missing duplicate request ID.");
      if (record.deleted_at) throw new HttpError(409,"Restore this card before duplicating it.");
      const previous = await client.from(kind).select("*").eq("id",body.id).eq("owner_id",user.id).maybeSingle();
      if (previous.data) return jsonResponse({record:previous.data});
      const {data,error} = await client.from(kind).insert({id:body.id,slug:newSlug(),owner_id:user.id,data:record.data,published:false}).select("*").single();
      if (error) throw error;
      return jsonResponse({record:data},201);
    }
    if (record.deleted_at && body.action !== "restore") throw new HttpError(409,"Restore this card before editing it.");
    const patch: Record<string,unknown> = {revision:record.revision+1};
    if (body.action === "save" || body.action === "publish") {
      patch.data = await normalize(kind,body.data ?? record.data,user.id);
      if (body.action === "publish") { requireConsent(kind,body.consent); patch.published=true; patch.published_data=patch.data; }
    }
    if (["unpublish","delete","restore"].includes(body.action)) patch.published=false;
    if (body.action === "delete") patch.deleted_at=new Date().toISOString();
    if (body.action === "restore") patch.deleted_at=null;
    const {data,error} = await client.from(kind).update(patch).eq("id",record.id).eq("owner_id",user.id).eq("revision",body.revision).select("*").maybeSingle();
    if (error) throw error;
    if (!data) throw new HttpError(409,"This card changed in another tab. Reload before saving.");
    return jsonResponse({record:data});
  } catch(e) { return errorResponse(e); }
}
