import type { CardData } from "./types";

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

/** Suggested filename base, e.g. "Christopher_Sabiti". */
export function contactFileBase(data: CardData): string {
  const base = `${data.firstName}_${data.lastName}`.trim().replace(/\s+/g, "_");
  return base || "contact";
}
