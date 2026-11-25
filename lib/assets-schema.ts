import { z } from "zod";
import { SOCIALS } from "./socials";

/** Product kinds that appear in the unified "My designs" library. */
export const assetKinds = ["card", "group", "qr", "stamp", "signature", "print"] as const;
export type AssetKind = (typeof assetKinds)[number];
export const assetSections = ["all", "favorites", "recent", "trash"] as const;
export type AssetSection = (typeof assetSections)[number];
export const assetSorts = ["updated", "created", "name"] as const;
export type AssetSort = (typeof assetSorts)[number];

/** Private label used to find a design. Never printed or published. */
export const assetName = z.string().trim().min(1, "Give this design a name.").max(120, "Names can be up to 120 characters.");

export const assetListSchema = z.object({
  kind: z.union([z.literal(""), z.enum(assetKinds)]).default(""),
  q: z.string().max(120).default(""),
  section: z.enum(assetSections).default("all"),
  sort: z.enum(assetSorts).default("updated"),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});

export const assetActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rename"), name: assetName }).strict(),
  z.object({ action: z.literal("favorite"), favorite: z.boolean() }).strict(),
  z.object({ action: z.literal("opened") }).strict(),
  // Product-owned lifecycles for designs without their own endpoint.
  z.object({ action: z.literal("trash") }).strict(),
  z.object({ action: z.literal("restore") }).strict(),
  z.object({ action: z.literal("duplicate"), id: z.uuid() }).strict(),
]);
export type AssetAction = z.infer<typeof assetActionSchema>;

const webUrl = z.string().max(2000).refine((value) => {
  if (!value) return true;
  try { const u = new URL(value); return ["https:", "http:"].includes(u.protocol) && !u.username && !u.password; } catch { return false; }
}, "Use an http or https link.");
const socialKeys = SOCIALS.map((s) => s.key) as [string, ...string[]];

/** Mirrors SignatureData in lib/email-signature.ts. */
export const signatureSchema = z.object({
  name: z.string().trim().min(1, "Add your name.").max(300),
  title: z.string().max(300), company: z.string().max(300),
  email: z.union([z.literal(""), z.email().max(300)]), phone: z.string().max(300).regex(/^[+\d ()./-]*$/, "Use digits, spaces and + ( ) - in phone numbers."),
  website: webUrl, photo: webUrl, link: webUrl, cardUrl: webUrl,
  cta: z.string().max(80),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  font: z.enum(["Arial", "Georgia", "Verdana"]),
  layout: z.enum(["classic", "stacked"]),
  socials: z.partialRecord(z.enum(socialKeys), webUrl),
}).strict();
export const signatureSaveSchema = z.object({ id: z.uuid().optional(), revision: z.number().int().positive().optional(), name: assetName, design: signatureSchema }).strict();

export const printConfigSchema = z.object({
  cardId: z.union([z.literal(""), z.uuid()]),
  qrId: z.union([z.literal(""), z.uuid()]),
  stampId: z.union([z.literal(""), z.uuid()]),
  parts: z.object({ card: z.boolean(), qr: z.boolean(), stamp: z.boolean() }).strict(),
  preset: z.enum(["exact", "bleed"]),
}).strict().refine((c) => (c.parts.card && c.cardId) || (c.parts.qr && c.qrId) || (c.parts.stamp && c.stampId), "Choose at least one design for the package.");
export type PrintConfig = z.infer<typeof printConfigSchema>;
export const printSaveSchema = z.object({ id: z.uuid().optional(), revision: z.number().int().positive().optional(), name: assetName, config: printConfigSchema }).strict();
export const emptyPrintConfig = (): PrintConfig => ({ cardId: "", qrId: "", stampId: "", parts: { card: true, qr: true, stamp: false }, preset: "exact" });

/** One library row as returned by list_design_assets. */
export interface AssetItem {
  kind: AssetKind; id: string; slug: string | null; name: string; derivedName: string;
  data: Record<string, unknown>; published: boolean; upToDate: boolean; archived: boolean; revision: number;
  createdAt: string; updatedAt: string; deletedAt: string | null; favorite: boolean; openedAt: string | null;
}
export interface AssetPage { total: number; counts: Partial<Record<AssetKind, number>>; items: AssetItem[] }

/** Where each design is edited. Cards, teams and QR codes keep their full editors. */
export function assetEditHref(a: Pick<AssetItem, "kind" | "id" | "slug">): string {
  switch (a.kind) {
    case "card": return `/edit/cards/${a.slug}`;
    case "group": return `/edit/groups/${a.slug}`;
    case "qr": return `/qr-studio/${a.slug}`;
    case "stamp": return `/stamp-maker?design=${a.id}`;
    case "signature": return `/email-signature?design=${a.id}`;
    case "print": return `/designs/print/${a.id}`;
  }
}
