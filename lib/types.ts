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
}

/** A row from the `cards` table. */
export interface CardRecord {
  id: string;
  slug: string;
  data: CardData;
  created_at: string;
  view_count: number;
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
});
