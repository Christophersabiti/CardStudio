import { z } from "zod";
import { strToU8, unzipSync, zipSync } from "fflate";
import { requireUser } from "@/lib/auth/session";
import { requireFeature } from "@/lib/features";
import { printConfigSchema } from "@/lib/assets-schema";
import { touchAsset } from "@/lib/assets";
import { checkOrigin, errorResponse, HttpError, jsonResponse, readJson } from "@/lib/http";
import { rateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/server";
import { cardPrintZip } from "@/lib/print-package/card";
import { PrintError } from "@/lib/print-package/policy";
import { PrintPlanRequired } from "@/lib/print-package/service";
import { renderOwnedQr } from "@/lib/qr-studio/export";
import type { QrRecord } from "@/lib/qr-studio/schema";
import { renderStampPng, stampDesignSchema } from "@/lib/stamps";

export const runtime = "nodejs";
export const maxDuration = 60;
const body = z.object({ operation_id: z.uuid() }).strict();

/**
 * One ZIP with every part of a saved print package. Each part keeps its own rules:
 * the card needs a print plan and matching publication, the QR must be published
 * (plan logo/colour features apply), and the stamp counts toward the monthly
 * stamp generation quota exactly like a single stamp download.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    checkOrigin(req);
    const user = await requireUser("Sign in to download a print package.");
    await requireFeature("print_package");
    await rateLimit(user.id, "print-package", 6);
    const id = z.uuid().parse((await params).id);
    const { operation_id } = body.parse(await readJson(req, 1024));
    const c = createAdminClient();
    const pkg = await c.from("print_packages").select("name,config").eq("id", id).eq("owner_id", user.id).is("deleted_at", null).maybeSingle();
    if (pkg.error) throw pkg.error;
    if (!pkg.data) throw new HttpError(404, "Print package not found.");
    const config = printConfigSchema.parse(pkg.data.config);
    const files: Record<string, Uint8Array> = {};
    const notes: string[] = [];

    if (config.parts.card && config.cardId) {
      const card = await c.from("cards").select("slug,revision").eq("id", config.cardId).eq("owner_id", user.id).is("deleted_at", null).maybeSingle();
      if (card.error) throw card.error;
      if (!card.data) throw new HttpError(409, "The business card in this package is in Trash or was removed. Choose another card.");
      try {
        const result = await cardPrintZip(user, card.data.slug, card.data.revision, config.preset);
        for (const [name, bytes] of Object.entries(unzipSync(new Uint8Array(result.zip)))) files[`business-card/${name}`] = bytes;
        notes.push(`business-card/: front.pdf, back.pdf and mockup.png (${result.mode === "dynamic" ? "online profile QR" : "offline contact QR"}, ${config.preset === "bleed" ? "with bleed" : "exact size"}).`);
      } catch (e) {
        if (e instanceof PrintError && !(e instanceof PrintPlanRequired)) throw new HttpError(e.status, `Business card: ${e.message}`);
        throw e;
      }
    }
    if (config.parts.qr && config.qrId) {
      const q = await c.from("qr_codes").select("*").eq("id", config.qrId).eq("owner_id", user.id).maybeSingle();
      if (q.error) throw q.error;
      try {
        const { output } = await renderOwnedQr(user.id, q.data as QrRecord | null, { svg: false, card: true });
        files["qr-code.png"] = new Uint8Array(output.png);
        notes.push("qr-code.png: your published QR code with its caption.");
      } catch (e) {
        if (e instanceof HttpError) throw new HttpError(e.status, `QR code: ${e.message}`);
        throw e;
      }
    }
    let stampId = "";
    if (config.parts.stamp && config.stampId) {
      const s = await c.from("stamp_designs").select("id,design").eq("id", config.stampId).eq("owner_id", user.id).is("deleted_at", null).maybeSingle();
      if (s.error) throw s.error;
      if (!s.data) throw new HttpError(409, "The stamp in this package is in Trash or was removed. Choose another stamp.");
      files["stamp-transparent.png"] = new Uint8Array(await renderStampPng(stampDesignSchema.parse(s.data.design), user.id));
      notes.push("stamp-transparent.png: 1500 × 1500 px with a transparent background.");
      stampId = s.data.id;
    }
    if (!Object.keys(files).length) throw new HttpError(400, "Choose at least one design for this package.");
    // Count the stamp only once every part rendered, so a failed package costs nothing.
    if (stampId) {
      const quota = await c.rpc("record_stamp_generation", { account_id: user.id, operation: operation_id, design: stampId });
      if (quota.error) {
        if (quota.error.code === "P0001") throw new HttpError(429, "You have reached this plan’s monthly stamp generation limit. Remove the stamp from the package or wait for your next billing month.");
        throw quota.error;
      }
    }
    files["README.txt"] = strToU8(`${pkg.data.name}\n\n${notes.join("\n")}\n\nGenerated by Card Studio on ${new Date().toISOString().slice(0, 10)}.\n`);
    await touchAsset(user.id, "print", id);
    const filename = `${pkg.data.name.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "print-package"}.zip`;
    return new Response(new Uint8Array(zipSync(files)), { headers: {
      "Content-Type": "application/zip", "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
    } });
  } catch (error) {
    if (error instanceof PrintPlanRequired) return jsonResponse({ error: error.message, code: "plan_required" }, 403);
    if (error instanceof PrintError) return errorResponse(new HttpError(error.status, error.message));
    return errorResponse(error);
  }
}
