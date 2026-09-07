import { z } from "zod";

export const qrTypes = [
  "event",
  "location",
  "links",
  "image",
  "video",
  "url",
] as const;
export const assetRef = z.string().regex(/^\/api\/qr-assets\/[0-9a-f-]{36}$/);
export const webUrl = z
  .url()
  .max(2000)
  .refine((value) => {
    try {
      const u = new URL(value);
      return (
        ["https:", "http:"].includes(u.protocol) && !u.username && !u.password
      );
    } catch {
      return false;
    }
  }, "Use an http or https URL without credentials.");
const optionalUrl = z.union([z.literal(""), webUrl]);
const imageRef = z.union([z.literal(""), assetRef]);
const media = z
  .object({
    kind: z.enum(["image", "video"]),
    source: z.union([assetRef, webUrl]),
    alt: z.string().max(300),
  })
  .strict();
export const common = {
  version: z.literal(1),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000),
  caption: z.string().max(160),
  logo: imageRef,
  logoFit: z.enum(["contain", "cover"]).optional(),
  cover: imageRef,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .refine((value) => {
      const c = value
        .slice(1)
        .match(/../g)!
        .map((v) => parseInt(v, 16) / 255)
        .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
      return 1.05 / (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] + 0.05) >= 7;
    }, "Choose a darker QR color (minimum 7:1 contrast on white)."),
  links: z
    .array(
      z
        .object({ label: z.string().trim().min(1).max(80), url: webUrl })
        .strict(),
    )
    .max(20),
  media: z.array(media).max(5),
};
const place = {
  venue: z.string().max(200),
  address: z.string().max(500),
  directions: optionalUrl,
  hours: z.string().max(500),
  phone: z
    .string()
    .max(40)
    .regex(/^[+\d ()-]*$/),
};
const timezone = z
  .string()
  .max(80)
  .refine((v) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: v });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone.");
export const qrSchema = z
  .discriminatedUnion("type", [
    z
      .object({
        ...common,
        type: z.literal("event"),
        ...place,
        start: z.iso.datetime(),
        end: z.iso.datetime(),
        timezone,
        status: z.enum(["scheduled", "cancelled"]),
      })
      .strict(),
    z.object({ ...common, type: z.literal("location"), ...place }).strict(),
    z.object({ ...common, type: z.literal("links") }).strict(),
    z
      .object({
        ...common,
        type: z.literal("image"),
        source: z.union([assetRef, webUrl]),
        alt: z.string().max(300),
      })
      .strict(),
    z
      .object({
        ...common,
        type: z.literal("video"),
        source: z.union([assetRef, webUrl]),
        alt: z.string().max(300),
      })
      .strict(),
    z.object({ ...common, type: z.literal("url"), url: webUrl }).strict(),
  ])
  .superRefine((d, ctx) => {
    if (d.type === "event" && Date.parse(d.end) <= Date.parse(d.start))
      ctx.addIssue({
        code: "custom",
        path: ["end"],
        message: "End must be after start.",
      });
  });
// Private drafts may be incomplete; publication always uses qrSchema above.
const draftCommon = {
  ...common,
  title: z.string().max(200),
  links: z
    .array(z.object({ label: z.string().max(80), url: optionalUrl }).strict())
    .max(20),
  media: z
    .array(media.extend({ source: z.union([z.literal(""), assetRef, webUrl]) }))
    .max(5),
};
export const qrDraftSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...draftCommon,
      type: z.literal("event"),
      ...place,
      start: z.union([z.literal(""), z.iso.datetime()]),
      end: z.union([z.literal(""), z.iso.datetime()]),
      timezone,
      status: z.enum(["scheduled", "cancelled"]),
    })
    .strict(),
  z.object({ ...draftCommon, type: z.literal("location"), ...place }).strict(),
  z.object({ ...draftCommon, type: z.literal("links") }).strict(),
  z
    .object({
      ...draftCommon,
      type: z.literal("image"),
      source: z.union([z.literal(""), assetRef, webUrl]),
      alt: z.string().max(300),
    })
    .strict(),
  z
    .object({
      ...draftCommon,
      type: z.literal("video"),
      source: z.union([z.literal(""), assetRef, webUrl]),
      alt: z.string().max(300),
    })
    .strict(),
  z
    .object({ ...draftCommon, type: z.literal("url"), url: optionalUrl })
    .strict(),
]);
export type QrData = z.infer<typeof qrSchema>;
export interface QrRecord {
  id: string;
  slug: string;
  owner_id: string;
  data: QrData;
  published_data: QrData | null;
  published: boolean;
  revision: number;
  deleted_at: string | null;
  archived_at: string | null;
}
export function emptyQr(type: QrData["type"] = "event"): QrData {
  const base = {
    version: 1 as const,
    title: "",
    description: "",
    caption: "Scan for event details",
    logo: "",
    cover: "",
    color: "#202520",
    links: [],
    media: [],
  };
  const place = {
    venue: "",
    address: "",
    directions: "",
    hours: "",
    phone: "",
  };
  if (type === "event")
    return {
      ...base,
      type,
      ...place,
      start: "",
      end: "",
      timezone: "Africa/Kampala",
      status: "scheduled",
    };
  if (type === "location")
    return { ...base, type, ...place, caption: "Scan to explore this place" };
  if (type === "image" || type === "video")
    return {
      ...base,
      type,
      source: "",
      alt: "",
      caption: type === "image" ? "Scan to view the image" : "Scan to watch",
    };
  if (type === "url")
    return { ...base, type, url: "", caption: "Scan to visit" };
  return { ...base, type, caption: "Scan to explore" };
}
export function assetReferences(
  d: QrData,
): { id: string; kind: "image" | "video" }[] {
  const refs: { source: string; kind: "image" | "video" }[] = [
    { source: d.logo, kind: "image" as const },
    { source: d.cover, kind: "image" as const },
    ...d.media,
  ];
  if (d.type === "image" || d.type === "video")
    refs.push({ source: d.source, kind: d.type });
  return refs
    .filter((r) => assetRef.safeParse(r.source).success)
    .map((r) => ({ id: r.source.split("/").pop()!, kind: r.kind }));
}
export function directionsUrl(
  d: Extract<QrData, { type: "event" | "location" }>,
) {
  return (
    d.directions ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([d.venue, d.address].filter(Boolean).join(", "))}`
  );
}
export function videoEmbed(source: string) {
  try {
    const u = new URL(source);
    let id: string | null = null;
    if (
      ["youtube.com", "www.youtube.com", "m.youtube.com"].includes(u.hostname)
    )
      id =
        u.pathname === "/watch"
          ? u.searchParams.get("v")
          : u.pathname.match(/^\/(?:shorts|embed)\/([\w-]+)$/)?.[1] || null;
    if (u.hostname === "youtu.be") id = u.pathname.slice(1);
    if (id && /^[\w-]{11}$/.test(id))
      return `https://www.youtube-nocookie.com/embed/${id}`;
    if (
      ["vimeo.com", "www.vimeo.com"].includes(u.hostname) &&
      /^\/\d+$/.test(u.pathname)
    )
      return `https://player.vimeo.com/video${u.pathname}`;
  } catch {}
  return null;
}
// Calendar instants are stored as UTC; the editor converts explicitly from the selected zone.
export function localToUtc(local: string, zone: string): string {
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(local)) return "";
  const target = Date.parse(local + ":00Z");
  const format = (ms: number) =>
    new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(ms))
      .replace(" ", "T");
  let guess = target;
  for (let i = 0; i < 4; i++)
    guess += target - Date.parse(format(guess) + ":00Z");
  if (format(guess) !== local)
    throw Error(
      "This time does not exist in the selected timezone. Choose another time.",
    );
  // Reject ambiguous fall-back times rather than silently choosing the wrong occurrence.
  if (
    [-7200000, -3600000, 3600000, 7200000].some(
      (delta) => format(guess + delta) === local,
    )
  )
    throw Error(
      "This time occurs twice due to daylight saving. Choose an unambiguous time.",
    );
  return new Date(guess).toISOString();
}
export function utcToLocal(utc: string, zone: string) {
  if (!utc) return "";
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .format(new Date(utc))
      .replace(" ", "T");
  } catch {
    return "";
  }
}
export function calendar(d: Extract<QrData, { type: "event" }>, slug: string) {
  const escape = (s: string) =>
    s
      .replace(/\\/g, "\\\\")
      .replace(/\r?\n/g, "\\n")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,");
  const stamp = (s: string) =>
    new Date(s)
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Card Studio//Events//EN",
    "BEGIN:VEVENT",
    `UID:${slug}@card-studio`,
    `DTSTAMP:${stamp(d.start)}`,
    `DTSTART:${stamp(d.start)}`,
    `DTEND:${stamp(d.end)}`,
    `SUMMARY:${escape(d.title)}`,
    `DESCRIPTION:${escape(d.description)}`,
    `LOCATION:${escape([d.venue, d.address].filter(Boolean).join(", "))}`,
    `STATUS:${d.status === "cancelled" ? "CANCELLED" : "CONFIRMED"}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return (
    lines
      .map((line) => {
        let out = "",
          length = 0;
        for (const char of line) {
          const n = new TextEncoder().encode(char).length;
          if (length + n > 73) {
            out += "\r\n ";
            length = 1;
          }
          out += char;
          length += n;
        }
        return out;
      })
      .join("\r\n") + "\r\n"
  );
}
