import "server-only";
import { activeBrand } from "@/lib/brand";
import { ownedRecord } from "@/lib/records";
import { cardSchema } from "@/lib/validation";
import type { SessionUser } from "@/lib/auth/session";
import type { CardData, CardRecord } from "@/lib/types";
import { printAccess } from "./access";
import { brandPrintImage, ownedPrintImage } from "./assets";
import { createPrintPackage } from "./service";
import { renderPrintPackage } from "./render";
import type { PrintPreset } from "./policy";

/** The card's print-ready ZIP (front.pdf, back.pdf, mockup.png) for its verified owner. */
export async function cardPrintZip(user: SessionUser, slug: string, revision: number, preset: PrintPreset) {
  return createPrintPackage(user.id, slug, revision, preset, process.env.NEXT_PUBLIC_SITE_URL, {
    ownedRecord: async (cardSlug, ownerId) => {
      const record = await ownedRecord("cards", cardSlug, ownerId) as CardRecord | null;
      return record ? { ...record, data: cardSchema.parse(record.data) as CardData } : null;
    },
    allowed: async () => (await printAccess(user)).allowed,
    render: async (snapshot, p, ownerId) => {
      const [photo, logo] = await Promise.all([ownedPrintImage(snapshot.data.photo, ownerId), snapshot.data.logo ? ownedPrintImage(snapshot.data.logo, ownerId) : brandPrintImage(activeBrand.logo)]);
      return (await renderPrintPackage({ ...snapshot, brand: activeBrand, photo, logo, preset: p })).zip;
    },
  });
}
