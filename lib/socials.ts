export interface SocialPlatform {
  key: string;
  name: string;
  /** short monogram shown in the badge */
  mono: string;
  /** brand color for the badge */
  color: string;
  placeholder: string;
}

export const SOCIALS: SocialPlatform[] = [
  { key: "linkedin", name: "LinkedIn", mono: "in", color: "#0A66C2", placeholder: "linkedin.com/in/…" },
  { key: "twitter", name: "X", mono: "X", color: "#111111", placeholder: "x.com/…" },
  { key: "youtube", name: "YouTube", mono: "YT", color: "#FF0000", placeholder: "youtube.com/@…" },
  { key: "instagram", name: "Instagram", mono: "IG", color: "#E1306C", placeholder: "instagram.com/…" },
  { key: "tiktok", name: "TikTok", mono: "TT", color: "#111111", placeholder: "tiktok.com/@…" },
  { key: "facebook", name: "Facebook", mono: "f", color: "#1877F2", placeholder: "facebook.com/…" },
  { key: "whatsapp", name: "WhatsApp", mono: "WA", color: "#25D366", placeholder: "wa.me/256…" },
  { key: "github", name: "GitHub", mono: "GH", color: "#111111", placeholder: "github.com/…" },
];

export const socialByKey = (key: string) => SOCIALS.find((s) => s.key === key);
