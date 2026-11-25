/**
 * PROTOTYPE ONLY — mock asset model for the Design Studio redesign review.
 * Nothing here talks to the database. See docs/design-studio-redesign-proposal.md.
 */
import type { CardData, GroupData } from "@/lib/types";
import { emptyCard } from "@/lib/types";
import { emptySignature, type SignatureData } from "@/lib/email-signature";
import { templates as stampTemplates, type Design as StampDesign, type Item as StampItem } from "@/components/marketing/StampMaker";

export type Kind = "card" | "qr" | "group" | "signature" | "stamp" | "print";

export const KINDS: { key: Kind; label: string; plural: string; color: string; blurb: string }[] = [
  { key: "card", label: "Business card", plural: "Business cards", color: "#507bea", blurb: "Contact card people save in one tap" },
  { key: "qr", label: "QR code", plural: "QR codes", color: "#16a37b", blurb: "Website, WhatsApp, Wi-Fi, location and more" },
  { key: "group", label: "Team contacts", plural: "Team contacts", color: "#d9822b", blurb: "A whole team from one link" },
  { key: "signature", label: "Email signature", plural: "Email signatures", color: "#8a5cf5", blurb: "Paste into Gmail or Outlook" },
  { key: "stamp", label: "E-stamp", plural: "E-stamps", color: "#c2414b", blurb: "Seals, approvals and date stamps" },
  { key: "print", label: "Print package", plural: "Print packages", color: "#4b5563", blurb: "Print-ready files in one download" },
];
export const kindInfo = (k: Kind) => KINDS.find((x) => x.key === k)!;

export type QrPurpose = "url" | "whatsapp" | "contact" | "event" | "location" | "wifi" | "email" | "phone" | "text";
export const QR_PURPOSES: { key: QrPurpose; label: string; field: string; placeholder: string }[] = [
  { key: "url", label: "Website", field: "Web address", placeholder: "https://sabtech.example" },
  { key: "whatsapp", label: "WhatsApp", field: "WhatsApp number", placeholder: "+256 700 000 000" },
  { key: "contact", label: "Contact", field: "Full name", placeholder: "Grace Nakato" },
  { key: "event", label: "Event", field: "Event page", placeholder: "https://events.example/summit" },
  { key: "location", label: "Location", field: "Place or address", placeholder: "Kampala Serena Hotel" },
  { key: "wifi", label: "Wi-Fi", field: "Network name", placeholder: "Office-Guest" },
  { key: "email", label: "Email", field: "Email address", placeholder: "hello@sabtech.example" },
  { key: "phone", label: "Phone", field: "Phone number", placeholder: "+256 700 000 000" },
  { key: "text", label: "Text", field: "Message", placeholder: "Any short text" },
];
export const purposeLabel = (p: QrPurpose) => QR_PURPOSES.find((x) => x.key === p)!.label;

export interface QrData { purpose: QrPurpose; value: string; extra: string; caption: string; color: string; logo: boolean; mode: "dynamic" | "static" }
export interface PrintData { cardId: string; stampId: string; qrId: string; parts: { card: boolean; qr: boolean; stamp: boolean }; paper: "A4" | "Letter" }

interface Base { id: string; name: string; templateName: string; favorite: boolean; createdAt: number; updatedAt: number; openedAt: number; deletedAt?: number }
export type Asset = Base & (
  | { kind: "card"; data: CardData }
  | { kind: "qr"; data: QrData }
  | { kind: "group"; data: GroupData }
  | { kind: "signature"; data: SignatureData }
  | { kind: "stamp"; data: StampDesign }
  | { kind: "print"; data: PrintData }
);
export type AssetOf<K extends Kind> = Extract<Asset, { kind: K }>;

export const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2));

/** The encoded QR payload — what a phone actually reads. */
export function qrPayload(q: QrData): string {
  const v = q.value.trim();
  switch (q.purpose) {
    case "whatsapp": return `https://wa.me/${v.replace(/[^\d]/g, "")}${q.extra ? `?text=${encodeURIComponent(q.extra)}` : ""}`;
    case "contact": return `BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${v}\r\nTEL:${q.extra}\r\nEND:VCARD`;
    case "location": return `https://maps.google.com/?q=${encodeURIComponent(v)}`;
    case "wifi": return `WIFI:T:WPA;S:${v.replace(/([\\;,:"])/g, "\\$1")};P:${q.extra.replace(/([\\;,:"])/g, "\\$1")};;`;
    case "email": return `mailto:${v}`;
    case "phone": return `tel:${v.replace(/[^+\d]/g, "")}`;
    default: return v || "https://example.com";
  }
}
export const QR_EXTRA: Partial<Record<QrPurpose, string>> = { whatsapp: "Pre-filled message", contact: "Phone", wifi: "Password" };

/** Text that the library search should match beyond the name. */
export function searchText(a: Asset): string {
  switch (a.kind) {
    case "stamp": return a.data.items.map((i) => i.text).join(" ") + " " + a.data.shape;
    case "card": return [a.data.firstName, a.data.lastName, a.data.title, a.data.organization, a.data.emails.join(" ")].join(" ");
    case "qr": return `${purposeLabel(a.data.purpose)} ${a.data.value} ${a.data.caption}`;
    case "group": return [a.data.name, a.data.organization, ...a.data.members.map((m) => `${m.firstName} ${m.lastName} ${m.title}`)].join(" ");
    case "signature": return [a.data.name, a.data.title, a.data.company, a.data.email].join(" ");
    case "print": return "print package A4 business card qr stamp";
  }
}

/** Short chips shown on asset cards. */
export function assetChips(a: Asset): string[] {
  switch (a.kind) {
    case "stamp": return [a.data.shape, "Transparent PNG"];
    case "card": return [a.data.orientation === "portrait" ? "Portrait" : "Landscape", "Published"];
    case "qr": return [purposeLabel(a.data.purpose), a.data.mode === "dynamic" ? "Editable link" : "Fixed"];
    case "group": return [`${a.data.members.length} people`];
    case "signature": return [a.data.layout === "stacked" ? "Stacked" : "Classic"];
    case "print": return [a.data.paper, `${Object.values(a.data.parts).filter(Boolean).length} parts`];
  }
}

// ---------------------------------------------------------------- templates

export interface TemplateDef { key: string; kind: Kind; name: string; note: string; suggest: string; make: () => Asset["data"] }

function stampItem(text: string, place: StampItem["place"], size: number, bold: boolean, curved: boolean, color: string): StampItem {
  return { id: newId(), text, place, size, bold, curved, font: "Arial", color, letterSpacing: curved ? 1 : 0 };
}
export function stampFrom(t: (typeof stampTemplates)[number], color = "#1d4ed8"): StampDesign {
  return { title: t.name, shape: t.shape, color, border: t.border, borderStyle: "Double ring", aging: 0, dateFormat: "DD/MM/YYYY", items: t.lines.map(([text, place, size, bold, curved]) => stampItem(text, place, size, bold, curved, color)) };
}
const stampPick = ["Director rectangle", "Received date stamp", "Company seal", "Authorised signatory", "Octagon company seal", "Shield crest seal", "Certified professional", "Common seal (burst)"];

const card = (p: Partial<CardData>): CardData => ({ ...emptyCard(), ...p });
const sig = (p: Partial<SignatureData>): SignatureData => ({ ...emptySignature, ...p });

export const TEMPLATES: TemplateDef[] = [
  ...stampTemplates.filter((t) => stampPick.includes(t.name)).map((t): TemplateDef => ({ key: `stamp:${t.name}`, kind: "stamp", name: t.name, note: t.category, suggest: `${t.name} stamp`, make: () => stampFrom(t) })),
  { key: "stamp:approved", kind: "stamp", name: "Approved", note: "Workflow", suggest: "Approved stamp", make: () => ({ title: "Approved", shape: "Rectangle", color: "#15803d", border: 4, borderStyle: "Double ring", aging: 0, dateFormat: "DD MMM YYYY", items: [stampItem("APPROVED", "center", 22, true, false, "#15803d")] }) },
  { key: "stamp:paid", kind: "stamp", name: "Paid", note: "Finance", suggest: "Paid stamp", make: () => ({ title: "Paid", shape: "Oval", color: "#dc2626", border: 4, borderStyle: "Double ring", aging: 10, dateFormat: "DD MMM YYYY", items: [stampItem("FINANCE OFFICE", "top", 10, true, true, "#dc2626"), stampItem("PAID", "center", 26, true, false, "#dc2626")] }) },
  { key: "card:classic", kind: "card", name: "Classic landscape", note: "Logo colours", suggest: "My business card", make: () => card({ firstName: "Your", lastName: "Name", title: "Job title", organization: "Company", orientation: "landscape" }) },
  { key: "card:portrait", kind: "card", name: "Portrait", note: "Phone-first", suggest: "Portrait business card", make: () => card({ firstName: "Your", lastName: "Name", title: "Job title", organization: "Company", orientation: "portrait" }) },
  { key: "card:bold", kind: "card", name: "Bold colour", note: "Custom colours", suggest: "Bold business card", make: () => card({ firstName: "Your", lastName: "Name", title: "Job title", organization: "Company", appearance: { mode: "custom", primary: "#1f3a8a", secondary: "#f59e0b" } }) },
  ...QR_PURPOSES.slice(0, 7).map((p): TemplateDef => ({ key: `qr:${p.key}`, kind: "qr", name: `${p.label} QR`, note: p.key === "wifi" ? "Join without typing" : "Scan to open", suggest: `${p.label} QR`, make: () => ({ purpose: p.key, value: p.placeholder, extra: "", caption: `Scan for ${p.label.toLowerCase()}`, color: "#17141c", logo: false, mode: "dynamic" }) })),
  { key: "signature:classic", kind: "signature", name: "Classic", note: "Side by side", suggest: "My email signature", make: () => sig({ name: "Your Name", title: "Job title", company: "Company", email: "you@company.example", layout: "classic" }) },
  { key: "signature:stacked", kind: "signature", name: "Stacked", note: "Photo on top", suggest: "Stacked email signature", make: () => sig({ name: "Your Name", title: "Job title", company: "Company", email: "you@company.example", layout: "stacked", color: "#1f3a8a" }) },
  { key: "group:dept", kind: "group", name: "Department", note: "Office team", suggest: "Team contacts", make: () => ({ name: "Team", organization: "Company", tagline: "", members: [] }) },
  { key: "group:event", kind: "group", name: "Event roster", note: "Speakers or hosts", suggest: "Event contacts", make: () => ({ name: "Event team", organization: "", tagline: "Save everyone in one tap", members: [] }) },
  { key: "print:starter", kind: "print", name: "Starter kit", note: "Card + QR", suggest: "Print package", make: () => ({ cardId: "", stampId: "", qrId: "", parts: { card: true, qr: true, stamp: false }, paper: "A4" }) },
  { key: "print:office", kind: "print", name: "Office kit", note: "Card + QR + stamp", suggest: "Office print package", make: () => ({ cardId: "", stampId: "", qrId: "", parts: { card: true, qr: true, stamp: true }, paper: "A4" }) },
];

// ---------------------------------------------------------------- sample library

const DAY = 86_400_000;
export function seedAssets(now = Date.now()): Asset[] {
  const t = (name: string) => stampTemplates.find((x) => x.name === name)!;
  const at = (days: number, hours = 0) => now - days * DAY - hours * 3_600_000;
  const director: StampDesign = { title: "Director rectangle", shape: "Rectangle", color: "#1d4ed8", border: 3, borderStyle: "Double ring", aging: 0, dateFormat: "DD/MM/YYYY", items: [stampItem("DIRECTOR", "top", 13, true, false, "#1d4ed8"), stampItem("APPROVED", "center", 18, true, false, "#1d4ed8"), stampItem("SABTECH ONLINE", "bottom", 10, true, false, "#1d4ed8")] };
  const received = stampFrom(t("Received date stamp"), "#b91c1c");
  const seal = stampFrom(t("Company seal"), "#1e3a8a");
  seal.items = seal.items.map((i) => (i.place === "top" ? { ...i, text: "SABTECH ONLINE LIMITED" } : i.place === "bottom" ? { ...i, text: "KAMPALA · UGANDA" } : i));
  const paid = TEMPLATES.find((x) => x.key === "stamp:paid")!.make() as StampDesign;
  const base = { favorite: false, deletedAt: undefined };
  const list: Asset[] = [
    { ...base, id: "a-stamp-director", kind: "stamp", name: "Director Approval Stamp – Uganda", templateName: "Director rectangle", favorite: true, createdAt: at(30), updatedAt: at(1, 2), openedAt: at(1, 2), data: director },
    { ...base, id: "a-card-chris", kind: "card", name: "Christopher’s Business Card", templateName: "Classic landscape", favorite: true, createdAt: at(40), updatedAt: at(2), openedAt: at(2), data: card({ firstName: "Christopher", lastName: "Sabiti", title: "Founder & Lead Consultant", organization: "Sabtech Online", phones: [{ type: "CELL", value: "+256 700 000 000" }], emails: ["hello@sabtech.example"], websites: ["https://sabtech.example"], location: "Kampala, Uganda", tagline: "Project delivery, done right.", appearance: { mode: "custom", primary: "#1f3a8a", secondary: "#0ea5e9" } }) },
    { ...base, id: "a-qr-whatsapp", kind: "qr", name: "WhatsApp Contact", templateName: "WhatsApp QR", createdAt: at(12), updatedAt: at(3), openedAt: at(3), data: { purpose: "whatsapp", value: "+256 700 000 000", extra: "Hello Sabtech, I’d like to book a session.", caption: "Chat with us on WhatsApp", color: "#0f5132", logo: true, mode: "dynamic" } },
    { ...base, id: "a-sig-corp", kind: "signature", name: "Sabtech Corporate Signature", templateName: "Classic", createdAt: at(20), updatedAt: at(4), openedAt: at(4), data: sig({ name: "Christopher Sabiti", title: "Founder & Lead Consultant", company: "Sabtech Online", email: "hello@sabtech.example", phone: "+256 700 000 000", website: "https://sabtech.example", color: "#1f3a8a", layout: "classic", socials: { linkedin: "https://linkedin.com/company/example" } }) },
    { ...base, id: "a-stamp-received", kind: "stamp", name: "Accounts – Received (dated)", templateName: "Received date stamp", createdAt: at(25), updatedAt: at(5), openedAt: at(5), data: received },
    { ...base, id: "a-group-leaders", kind: "group", name: "Sabtech leadership team", templateName: "Department", createdAt: at(18), updatedAt: at(6), openedAt: at(6), data: { name: "Sabtech leadership", organization: "Sabtech Online", tagline: "Save our whole team in one tap", members: [
      { firstName: "Christopher", lastName: "Sabiti", title: "Founder", organization: "", phone: "+256 700 000 001", email: "chris@sabtech.example" },
      { firstName: "Grace", lastName: "Nakato", title: "Head of Sales", organization: "", phone: "+256 700 000 002", email: "grace@sabtech.example" },
      { firstName: "Daniel", lastName: "Okello", title: "Training Lead", organization: "", phone: "+256 700 000 003", email: "daniel@sabtech.example" },
      { firstName: "Ruth", lastName: "Achieng", title: "Operations", organization: "", phone: "+256 700 000 004", email: "ruth@sabtech.example" },
    ] } },
    { ...base, id: "a-qr-site", kind: "qr", name: "Sabtech website", templateName: "Website QR", createdAt: at(50), updatedAt: at(8), openedAt: at(8), data: { purpose: "url", value: "https://sabtech.example", extra: "", caption: "Visit sabtech.example", color: "#1f3a8a", logo: false, mode: "dynamic" } },
    { ...base, id: "a-print-kit", kind: "print", name: "Sabtech office print kit", templateName: "Office kit", createdAt: at(9), updatedAt: at(9), openedAt: at(9), data: { cardId: "a-card-chris", stampId: "a-stamp-seal", qrId: "a-qr-site", parts: { card: true, qr: true, stamp: true }, paper: "A4" } },
    { ...base, id: "a-card-grace", kind: "card", name: "Grace Nakato – Sales lead", templateName: "Portrait", createdAt: at(15), updatedAt: at(10), openedAt: at(10), data: card({ firstName: "Grace", lastName: "Nakato", title: "Head of Sales", organization: "Sabtech Online", orientation: "portrait", phones: [{ type: "WORK", value: "+256 700 000 002" }], emails: ["grace@sabtech.example"], websites: ["https://sabtech.example"], location: "Kampala" }) },
    { ...base, id: "a-stamp-seal", kind: "stamp", name: "Company common seal", templateName: "Company seal", favorite: true, createdAt: at(60), updatedAt: at(12), openedAt: at(12), data: seal },
    { ...base, id: "a-qr-venue", kind: "qr", name: "PMI Uganda summit – venue map", templateName: "Location QR", createdAt: at(14), updatedAt: at(13), openedAt: at(13), data: { purpose: "location", value: "Kampala Serena Hotel", extra: "", caption: "Directions to the venue", color: "#7c2d12", logo: false, mode: "dynamic" } },
    { ...base, id: "a-qr-wifi", kind: "qr", name: "Office guest Wi-Fi", templateName: "Wi-Fi QR", createdAt: at(70), updatedAt: at(21), openedAt: at(21), data: { purpose: "wifi", value: "Sabtech-Guest", extra: "welcome2026", caption: "Scan to join Wi-Fi", color: "#17141c", logo: false, mode: "static" } },
    { ...base, id: "a-stamp-paid", kind: "stamp", name: "Paid – Finance office", templateName: "Paid", createdAt: at(33), updatedAt: at(27), openedAt: at(27), data: paid },
    { ...base, id: "a-sig-personal", kind: "signature", name: "Christopher – stacked (personal)", templateName: "Stacked", createdAt: at(45), updatedAt: at(31), openedAt: at(31), data: sig({ name: "Christopher Sabiti", title: "PMP · Trainer", company: "", email: "chris@sabtech.example", website: "https://sabtech.example", color: "#596b48", layout: "stacked" }) },
  ];
  return list;
}

export function relativeTime(ts: number, now = Date.now()) {
  const d = Math.round((now - ts) / 60_000);
  if (d < 1) return "just now";
  if (d < 60) return `${d} min ago`;
  const h = Math.round(d / 60);
  if (h < 24) return `${h} h ago`;
  const days = Math.round(h / 24);
  if (days < 14) return days === 1 ? "yesterday" : `${days} days ago`;
  return new Date(ts).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
export const fullDate = (ts: number) => new Date(ts).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
