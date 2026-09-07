import "server-only";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/server";
import { currentUser } from "@/lib/auth/session";
import { publicOwnerActive } from "@/lib/public-access";
import {
  checkOrigin,
  errorResponse,
  HttpError,
  jsonResponse,
  readJson,
} from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { newSlug } from "@/lib/slug";
import {
  assetReferences,
  qrSchema,
  qrDraftSchema,
  type QrData,
  type QrRecord,
} from "./schema";
export const slugSchema = z.string().regex(/^[A-Za-z0-9_-]{8,64}$/);
export async function requireQrUser() {
  const user = await currentUser();
  if (!user) throw new HttpError(401, "Sign in to manage QR codes.");
  if (user.appRole !== "superadmin" && !user.onboardingComplete)
    throw new HttpError(409, "Choose a plan before saving.");
  return user;
}
export async function qrFeatures(owner: string) {
  const c = createAdminClient();
  const [p, u, s] = await Promise.all([
    c.rpc("effective_plan", { account_id: owner }),
    c.from("users").select("app_role").eq("id", owner).single(),
    c.from("commercial_settings").select("quotas_enabled").single(),
  ]);
  if (p.error || u.error || s.error) throw Error("Plan unavailable");
  const unlimited = u.data.app_role === "superadmin" || !s.data.quotas_enabled;
  return {
    logo: unlimited || p.data?.features?.qr_logo === true,
    colors: unlimited || p.data?.features?.custom_colors === true,
    svg: unlimited || p.data?.features?.qr_svg === true,
    analytics: unlimited || p.data?.features?.analytics === "totals",
  };
}
export async function ownedQr(slug: string, owner: string) {
  slugSchema.parse(slug);
  const r = await createAdminClient()
    .from("qr_codes")
    .select("*")
    .eq("slug", slug)
    .eq("owner_id", owner)
    .maybeSingle();
  if (r.error) throw r.error;
  return r.data as QrRecord | null;
}
export async function publicQr(slug: string) {
  if (!slugSchema.safeParse(slug).success) return null;
  const r = await createAdminClient()
    .from("qr_codes")
    .select("id,slug,owner_id,published_data")
    .eq("slug", slug)
    .eq("published", true)
    .is("deleted_at", null)
    .is("archived_at", null)
    .maybeSingle();
  if (r.error) throw r.error;
  if (!r.data || !(await publicOwnerActive(r.data.owner_id))) return null;
  const parsed = qrSchema.safeParse(r.data.published_data);
  return parsed.success ? { ...r.data, data: parsed.data } : null;
}
async function validateAssets(d: QrData, owner: string) {
  const refs = assetReferences(d);
  if (!refs.length) return;
  const r = await createAdminClient()
    .from("qr_assets")
    .select("id,kind,state")
    .eq("owner_id", owner)
    .in(
      "id",
      refs.map((a) => a.id),
    );
  if (r.error) throw r.error;
  if (
    refs.some(
      (ref) =>
        !r.data.some(
          (a) => a.id === ref.id && a.kind === ref.kind && a.state === "ready",
        ),
    )
  )
    throw new HttpError(
      400,
      "An uploaded file is unavailable, still processing, or has the wrong media type.",
    );
}
export async function qrEndpoint(req: Request, slug?: string) {
  try {
    checkOrigin(req);
    const user = await requireQrUser();
    await rateLimit(user.id, "qr-write", 30);
    const c = createAdminClient();
    const body = z
      .object({
        id: z.uuid().optional(),
        revision: z.number().int().nonnegative().optional(),
        action: z.enum([
          "save",
          "publish",
          "unpublish",
          "delete",
          "restore",
          "archive",
          "unarchive",
          "duplicate",
        ]),
        data: z.unknown().optional(),
      })
      .strict()
      .parse(await readJson(req, 100000));
    const previous = slug ? await ownedQr(slug, user.id) : null;
    if (slug && !previous) throw new HttpError(404, "QR code not found.");
    if (!previous && !body.id) throw new HttpError(400, "Missing request ID.");
    if (!previous && !["save", "publish"].includes(body.action))
      throw new HttpError(400, "Save or publish a new QR code first.");
    if (previous && previous.revision !== body.revision)
      throw new HttpError(
        409,
        "This QR changed in another tab. Reload before saving.",
      );
    if (previous?.deleted_at && body.action !== "restore")
      throw new HttpError(409, "Restore this QR first.");
    if (previous?.archived_at && !["unarchive", "delete"].includes(body.action))
      throw new HttpError(409, "Unarchive this QR first.");
    if (!previous || body.action === "duplicate") {
      if (!body.id) throw new HttpError(400, "Missing request ID.");
      const retry = await c
        .from("qr_codes")
        .select("*")
        .eq("id", body.id)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (retry.error) throw retry.error;
      if (retry.data) return jsonResponse({ record: retry.data });
    }
    const patch: Record<string, unknown> = {
      revision: (previous?.revision ?? -1) + 1,
    };
    if (!previous || ["save", "publish", "duplicate"].includes(body.action)) {
      const d = (body.action === "publish" ? qrSchema : qrDraftSchema).parse(
        body.action === "duplicate" ? previous!.data : body.data,
      );
      await validateAssets(d, user.id);
      const features = await qrFeatures(user.id);
      if (d.logo && !features.logo)
        throw new HttpError(403, "Your plan does not include center logos.");
      if (d.color !== "#202520" && !features.colors)
        throw new HttpError(
          403,
          "Your plan does not include custom QR colors.",
        );
      Object.assign(patch, {
        data: d,
        title: d.title || `Untitled ${d.type}`,
        description: d.description,
        caption: d.caption,
        type: d.type,
        mode: "dynamic",
      });
      if (body.action === "publish")
        Object.assign(patch, { published: true, published_data: d });
    }
    if (
      [
        "unpublish",
        "delete",
        "restore",
        "archive",
        "unarchive",
        "duplicate",
      ].includes(body.action)
    )
      patch.published = false;
    if (body.action === "delete") patch.deleted_at = new Date().toISOString();
    if (body.action === "restore")
      Object.assign(patch, { deleted_at: null, archived_at: null });
    if (body.action === "archive") patch.archived_at = new Date().toISOString();
    if (body.action === "unarchive") patch.archived_at = null;
    const creating = !previous || body.action === "duplicate";
    const r = creating
      ? await c
          .from("qr_codes")
          .insert({
            ...patch,
            id: body.id,
            owner_id: user.id,
            slug: newSlug(),
            revision: 0,
          })
          .select("*")
          .single()
      : await c
          .from("qr_codes")
          .update(patch)
          .eq("id", previous.id)
          .eq("owner_id", user.id)
          .eq("revision", body.revision)
          .select("*")
          .maybeSingle();
    if (r.error?.code === "23505" && creating) {
      const retry = await c
        .from("qr_codes")
        .select("*")
        .eq("id", body.id)
        .eq("owner_id", user.id)
        .maybeSingle();
      if (retry.data) return jsonResponse({ record: retry.data });
    }
    if (r.error) throw r.error;
    if (!r.data)
      throw new HttpError(
        409,
        "This QR changed in another tab. Reload before saving.",
      );
    return jsonResponse({ record: r.data }, creating ? 201 : 200);
  } catch (e) {
    return errorResponse(e);
  }
}
export async function trackQr(
  id: string,
  owner: string,
  metric: "opens" | "clicks",
  req: Request,
) {
  try {
    if (
      /bot|crawler|spider|preview/i.test(req.headers.get("user-agent") || "") ||
      req.headers.has("next-router-prefetch") ||
      req.headers.get("purpose") === "prefetch"
    )
      return;
    if (!(await qrFeatures(owner)).analytics) return;
    await createAdminClient().rpc("record_qr_metric", { qr_id: id, metric });
  } catch {
    /* Measurement never prevents viewing. */
  }
}
