import { z } from "zod";

const text = (max: number) => z.string().trim().max(max).refine(v => !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(v), "Remove control characters.");
const optionalText = (max: number) => text(max).default("");
export function safeWebUrl(value: string): boolean {
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}
const web = text(2048).refine(v => !v || safeWebUrl(v), "Use a complete https:// or http:// link.");
const email = text(254).refine(v => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Enter a valid email address.");
const phone = text(40).refine(v => !v || /^[+\d][\d\s().#x-]{2,39}$/i.test(v), "Enter a valid phone number, including country code.");
export const mediaPath = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const picture = z.string().max(550_000).refine(v => !v || mediaPath.test(v) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(v), "Choose a PNG, JPEG or WebP image.").default("");
const socials = z.object(Object.fromEntries(["linkedin","twitter","facebook","instagram","youtube","tiktok","github","whatsapp"].map(k => [k, web.optional()]))).strict();
export const cardSchema = z.object({
  firstName: optionalText(100), lastName: optionalText(100), title: optionalText(160), organization: optionalText(160),
  phones: z.array(z.object({ type: z.enum(["CELL","WORK","HOME","WHATSAPP","OTHER"]), value: phone }).strict()).max(10).default([]),
  emails: z.array(email).max(10).default([]), websites: z.array(web).max(10).default([]), socials: socials.default({}),
  location: optionalText(200), tagline: optionalText(600), role: optionalText(200),
  accent: z.enum(["primary","secondary","accent","ink"]).default("secondary"), photo: picture, logo: picture,
}).strict().refine(d => !!(d.firstName || d.lastName || d.organization), "Add a name or organization before saving.");
export const groupSchema = z.object({
  name: text(160).min(1, "Give the group a name."), organization: optionalText(160), tagline: optionalText(600),
  members: z.array(z.object({firstName: optionalText(100), lastName: optionalText(100), title: optionalText(160), organization: optionalText(160), phone, email}).strict().refine(m => !!(m.firstName || m.lastName), "Every member needs a name.")).min(1).max(500),
}).strict();
// Local recovery accepts incomplete field values, while retaining the shape and
// bounds needed for safe rendering. Cloud publication uses the strict schemas.
export const cardDraftSchema = z.object({
  ...cardSchema.shape,
  phones: z.array(z.object({type:z.enum(["CELL","WORK","HOME","WHATSAPP","OTHER"]),value:z.string().max(40)})).max(10),
  emails:z.array(z.string().max(254)).max(10), websites:z.array(z.string().max(2048)).max(10),
  socials:z.record(z.string().max(30),z.string().max(2048)).refine(v=>Object.keys(v).length<=8),
}).strict();
export const groupDraftSchema = z.object({
  ...groupSchema.shape, name:optionalText(160),
  members:z.array(z.object({firstName:optionalText(100),lastName:optionalText(100),title:optionalText(160),organization:optionalText(160),phone:z.string().max(40),email:z.string().max(254)})).max(500),
}).strict();
export const createSchema = z.object({ id: z.uuid(), data: z.unknown(), publish: z.boolean().default(false), consent: z.boolean().default(false) }).strict();
export const updateSchema = z.object({ action: z.enum(["save","publish","unpublish","delete","restore","duplicate"]), revision: z.number().int().nonnegative(), data: z.unknown().optional(), consent: z.boolean().default(false), id: z.uuid().optional() }).strict();
export const slugSchema = z.string().regex(/^[A-Za-z0-9_-]{6,40}$/);
export function safeNext(value: string | null | undefined): string {
  return value && /^\/(?:studio(?:\?[^\\]*)?|billing|dashboard(?:\?[^\\]*)?|edit\/(?:cards|groups)\/[A-Za-z0-9_-]{6,40}|\?[^\\]*)$/.test(value) ? value : "/dashboard";
}
