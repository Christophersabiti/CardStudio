import type { CardData, GroupData, GroupMember } from "./types";

/** Escape special characters per RFC 6350 (vCard). */
function esc(v: string): string {
  return (v || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

/**
 * Build a vCard 3.0 string. vCard 3.0 is the format most reliably saved by both
 * iPhone and Android camera apps when encoded in a QR code. Lines are joined with
 * CRLF as the spec requires.
 */
export function buildVcard(data: CardData): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");
  lines.push(`N:${esc(data.lastName)};${esc(data.firstName)};;;`);
  const fn = `${data.firstName} ${data.lastName}`.trim();
  lines.push(`FN:${esc(fn || data.organization || "Contact")}`);
  if (data.organization) lines.push(`ORG:${esc(data.organization)}`);
  if (data.title) lines.push(`TITLE:${esc(data.title)}`);

  for (const p of data.phones) {
    if (!p.value) continue;
    const type = p.type === "WHATSAPP" ? "CELL" : p.type;
    lines.push(`TEL;TYPE=${type},VOICE:${esc(p.value)}`);
  }
  for (const e of data.emails) {
    if (e) lines.push(`EMAIL;TYPE=INTERNET:${esc(e)}`);
  }
  for (const w of data.websites) {
    if (w) lines.push(`URL:${esc(w)}`);
  }
  for (const url of Object.values(data.socials)) {
    if (url) lines.push(`URL:${esc(url)}`);
  }
  if (data.location) {
    const [city = "", country = ""] = data.location.split(",").map((s) => s.trim());
    lines.push(`ADR;TYPE=WORK:;;;${esc(city)};;;${esc(country)}`);
  }
  if (data.tagline) lines.push(`NOTE:${esc(data.tagline.replace(/\n/g, " "))}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/** Suggested filename base, e.g. "Jane_Doe". */
export function contactFileBase(data: CardData): string {
  const base = `${data.firstName}_${data.lastName}`.trim().replace(/\s+/g, "_");
  return base || "contact";
}

/** Build one VCARD block for a group member (lighter field set than a full CardData). */
function buildMemberVcard(m: GroupMember, groupOrg: string): string {
  const lines: string[] = [];
  lines.push("BEGIN:VCARD");
  lines.push("VERSION:3.0");
  lines.push(`N:${esc(m.lastName)};${esc(m.firstName)};;;`);
  const fn = `${m.firstName} ${m.lastName}`.trim();
  lines.push(`FN:${esc(fn || "Contact")}`);
  const org = m.organization || groupOrg;
  if (org) lines.push(`ORG:${esc(org)}`);
  if (m.title) lines.push(`TITLE:${esc(m.title)}`);
  if (m.phone) lines.push(`TEL;TYPE=CELL,VOICE:${esc(m.phone)}`);
  if (m.email) lines.push(`EMAIL;TYPE=INTERNET:${esc(m.email)}`);
  lines.push("END:VCARD");
  return lines.join("\r\n");
}

/**
 * Build a batch vCard file: one VCARD block per member, concatenated. Opening
 * a .vcf with multiple VCARD blocks is what lets a phone's contacts app offer
 * a bulk "add N contacts" import in one step.
 */
export function buildGroupVcard(data: GroupData): string {
  return data.members.map((m) => buildMemberVcard(m, data.organization)).join("\r\n");
}

/** Suggested filename base for a group's combined .vcf / image, e.g. "Acme_Inc_Team". */
export function groupFileBase(data: GroupData): string {
  const base = data.name.trim().replace(/\s+/g, "_");
  return base || "group";
}
