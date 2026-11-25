/**
 * Single source for the site menu, footer and create hub.
 * Only products that customers can use today belong in `products`.
 */
export type ProductKey = "card" | "qr" | "group" | "signature" | "stamp" | "print";

export interface Product {
  key: ProductKey;
  title: string;
  /** One plain sentence: what the visitor gets. */
  summary: string;
  /** Where "Start" takes the visitor. */
  href: string;
  /** Optional longer explanation page. */
  learnMore?: string;
  /** Shown on the tile when the tool needs an account. */
  needsAccount?: boolean;
}

export const products: Product[] = [
  { key: "card", title: "Business card", summary: "Your contact details on a card people can save in one tap.", href: "/studio", learnMore: "/explore/digital-cards" },
  { key: "qr", title: "QR code", summary: "One scan opens an event, a map, your links, an image or a video.", href: "/qr-studio", learnMore: "/explore/qr-sharing", needsAccount: true },
  { key: "group", title: "Team contacts", summary: "Share a whole team or event roster from one link.", href: "/studio?mode=groups", learnMore: "/explore/group-contacts" },
  { key: "signature", title: "Email signature", summary: "A branded signature you can copy into Gmail or Outlook.", href: "/email-signature" },
  { key: "stamp", title: "E-stamp", summary: "A company seal or date stamp as a transparent PNG.", href: "/stamp-maker" },
  { key: "print", title: "Print package", summary: "Print-ready files of your published card. Basic and Premium plans.", href: "/explore/print-package" },
];

/** Which administrator switch controls each product. */
export const productFeature = {
  card: "cards",
  qr: "qr_codes",
  group: "groups",
  signature: "email_signature",
  stamp: "stamps",
  print: "print_package",
} as const satisfies Record<ProductKey, string>;

export interface NavLink { title: string; href: string; summary?: string }

export const helpLinks: NavLink[] = [
  { title: "Getting started", href: "/explore/guides", summary: "Make your first card in three steps." },
  { title: "FAQ", href: "/explore/faq", summary: "Straight answers to common questions." },
  { title: "What's new", href: "/explore/updates", summary: "What is available now and next." },
  { title: "Contact support", href: "/explore/contact", summary: "Get help with your account or billing." },
];

export const workLinks: NavLink[] = [
  { title: "My designs", href: "/designs", summary: "Every card, QR code, stamp, signature and print package you saved." },
  { title: "QR scan statistics", href: "/dashboard/qr", summary: "Opens, clicks and archived QR codes." },
  { title: "Billing & usage", href: "/billing", summary: "Your plan, limits and receipts." },
  { title: "Trash", href: "/designs?section=trash", summary: "Restore something you deleted." },
];

export const companyLinks: NavLink[] = [
  { title: "About", href: "/explore/about" },
  { title: "Pricing", href: "/pricing" },
  { title: "For teams", href: "/explore/teams" },
  { title: "For individuals", href: "/explore/individuals" },
];

/** True when `pathname` is the link's page or a page beneath it. */
export function isActive(pathname: string, href: string) {
  const path = href.split("?")[0];
  if (path === "/") return pathname === "/";
  return pathname === path || pathname.startsWith(`${path}/`);
}
