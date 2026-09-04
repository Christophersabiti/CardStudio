import type { ComponentType, SVGProps } from "react";
import {
  LinkedInIcon,
  XIcon,
  YouTubeIcon,
  InstagramIcon,
  TikTokIcon,
  FacebookIcon,
  WhatsAppIcon,
  GitHubIcon,
} from "@/components/icons";

export interface SocialPlatform {
  key: string;
  name: string;
  /** brand glyph shown in the badge */
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  /** brand color for the badge */
  color: string;
  placeholder: string;
}

export const SOCIALS: SocialPlatform[] = [
  { key: "linkedin", name: "LinkedIn", icon: LinkedInIcon, color: "#0A66C2", placeholder: "linkedin.com/in/…" },
  { key: "twitter", name: "X", icon: XIcon, color: "#111111", placeholder: "x.com/…" },
  { key: "youtube", name: "YouTube", icon: YouTubeIcon, color: "#FF0000", placeholder: "youtube.com/@…" },
  { key: "instagram", name: "Instagram", icon: InstagramIcon, color: "#E1306C", placeholder: "instagram.com/…" },
  { key: "tiktok", name: "TikTok", icon: TikTokIcon, color: "#111111", placeholder: "tiktok.com/@…" },
  { key: "facebook", name: "Facebook", icon: FacebookIcon, color: "#1877F2", placeholder: "facebook.com/…" },
  { key: "whatsapp", name: "WhatsApp", icon: WhatsAppIcon, color: "#25D366", placeholder: "wa.me/256…" },
  { key: "github", name: "GitHub", icon: GitHubIcon, color: "#111111", placeholder: "github.com/…" },
];

export const socialByKey = (key: string) => SOCIALS.find((s) => s.key === key);
