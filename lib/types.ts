export type PhoneType = "CELL" | "WORK" | "HOME" | "WHATSAPP" | "OTHER";

export interface Phone {
  type: PhoneType;
  value: string;
}

export type AccentKey = "primary" | "secondary" | "accent" | "ink";

/**
 * The full content of one business card. Stored as JSONB in the `cards` table
 * (column `data`). Keep this in sync with the migration and the builder form.
 */
export interface CardData {
  firstName: string;
  lastName: string;
  title: string; // designation / job title
  organization: string;
  phones: Phone[];
  emails: string[];
  websites: string[];
  /** platform key (see lib/socials.ts) -> profile URL */
  socials: Record<string, string>;
  location: string;
  tagline: string;
  role: string; // membership / role line shown on the aside
  accent: AccentKey;
  /** data URL (MVP) or Supabase Storage URL (later). May be empty. */
  photo: string;
  /** Optional per-card logo, data URL. Replaces the brand badge in the card's corner when set. */
  logo: string;
}

/** A row from the `cards` table. */
export interface CardRecord {
  id: string;
  slug: string;
  data: CardData;
  created_at: string;
  view_count: number;
  owner_id: string | null;
  published: boolean;
  published_data: CardData | null;
  deleted_at: string | null;
  revision: number;
  updated_at: string;
}

export const emptyCard = (): CardData => ({
  firstName: "",
  lastName: "",
  title: "",
  organization: "",
  phones: [{ type: "CELL", value: "" }],
  emails: [""],
  websites: [""],
  socials: {},
  location: "",
  tagline: "",
  role: "",
  accent: "secondary",
  photo: "",
  logo: "",
});

/** One person inside a bulk-uploaded group, parsed from a CSV row. */
export interface GroupMember {
  firstName: string;
  lastName: string;
  title: string;
  organization: string;
  phone: string;
  email: string;
}

/**
 * A group ("team") card: one shareable page and QR for many people at once.
 * Stored as JSONB in the `groups` table (column `data`). The QR encodes the
 * group's public URL (not raw vCard data — a QR can't hold many full vCards),
 * and that page offers a single .vcf download containing every member so a
 * phone's contacts app can bulk-import them in one step.
 */
export interface GroupData {
  name: string;
  organization: string;
  tagline: string;
  members: GroupMember[];
}

/** A row from the `groups` table. */
export interface GroupRecord {
  id: string;
  slug: string;
  data: GroupData;
  created_at: string;
  view_count: number;
  owner_id: string | null;
  published: boolean;
  published_data: GroupData | null;
  deleted_at: string | null;
  revision: number;
  updated_at: string;
}

export type RecordKind = "cards" | "groups";
export type StudioRecord = CardRecord | GroupRecord;

export const emptyGroup = (): GroupData => ({
  name: "",
  organization: "",
  tagline: "",
  members: [],
});
