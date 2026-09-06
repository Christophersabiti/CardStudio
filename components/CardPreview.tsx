import type { CardData } from "@/lib/types";
import type { Brand } from "@/lib/brand";
import { SOCIALS } from "@/lib/socials";
import { PhoneIcon, MailIcon, WebIcon, PinIcon, ScanIcon } from "./icons";
import { safeWebUrl } from "@/lib/validation";

function initials(data: CardData): string {
  const a = (data.firstName || "").trim()[0] || "";
  const b = (data.lastName || "").trim()[0] || "";
  const combined = (a + b).toUpperCase();
  return combined || (data.organization || "?").trim()[0]?.toUpperCase() || "?";
}

function stripUrl(u: string): string {
  return u.replace(/^https?:\/\//, "").replace(/\/$/, "");
}

/**
 * Presentational business card. Used by both the builder preview (qrUrl computed
 * on the client) and the public page (qrUrl computed on the server). No hooks, so
 * it renders in either environment.
 */
export default function CardPreview({
  data,
  qrUrl,
  brand,
  qrLabel = "Scan to save my contact",
}: {
  data: CardData;
  qrUrl: string;
  brand: Brand;
  qrLabel?: string;
}) {
  const name = `${data.firstName || ""} ${data.lastName || ""}`.trim();
  const phones = data.phones.filter((p) => p.value);
  const emails = data.emails.filter(Boolean);
  const websites = data.websites.filter(Boolean);

  return (
    <div
      className={`cs-card ${data.orientation === "portrait" ? "cs-card-portrait" : "cs-card-landscape"}`}
    >
      <div className="cs-main">
        <div className="cs-top">
          <div className="cs-photo">
            {data.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.photo} alt={name || "Profile"} />
            ) : (
              <span>{initials(data)}</span>
            )}
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="cs-name">{name || "Your Name"}</div>
            <div className="cs-title">{data.title || "Your designation"}</div>
            {data.organization ? (
              <div className="cs-org">{data.organization}</div>
            ) : null}
          </div>
        </div>

        <div className="cs-contact">
          {phones.map((p, i) => (
            <div className="cs-line" key={`p${i}`}>
              <span className="cs-ic">
                <PhoneIcon />
              </span>
              <span>{p.value}</span>
            </div>
          ))}
          {emails.map((email, i) => (
            <div className="cs-line" key={`email${i}`}>
              <span className="cs-ic">
                <MailIcon />
              </span>
              <span>{email}</span>
            </div>
          ))}
          {websites.map((website, i) => (
            <div className="cs-line" key={`website${i}`}>
              <span className="cs-ic">
                <WebIcon />
              </span>
              <span>{stripUrl(website)}</span>
            </div>
          ))}
        </div>

        <div className="cs-socials">
          {SOCIALS.filter(
            (s) => data.socials[s.key] && safeWebUrl(data.socials[s.key]),
          ).map((s) => (
            <a
              key={s.key}
              className="cs-badge"
              href={data.socials[s.key]}
              target="_blank"
              rel="noopener noreferrer"
              title={s.name}
              aria-label={s.name}
              style={{ background: s.color }}
            >
              <s.icon width={14} height={14} />
            </a>
          ))}
        </div>
      </div>

      <div className="cs-aside">
        <span className="cs-kicker">Personal details</span>
        <div className="cs-personal">
          {data.location ? (
            <div className="pp">
              <span
                style={{ opacity: 0.85, display: "inline-flex", width: 12 }}
              >
                <PinIcon />
              </span>
              <span>{data.location}</span>
            </div>
          ) : null}
          {data.role ? (
            <div className="pp">
              <b>{data.role}</b>
            </div>
          ) : null}
          {data.tagline ? (
            <div className="cs-tagline">{data.tagline}</div>
          ) : null}
        </div>

        <div className="cs-qr-chip">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt={qrLabel} width={128} height={128} />
          ) : (
            <div style={{ width: 128, height: 128 }} />
          )}
        </div>
        <div className="cs-qr-cta">
          <ScanIcon /> {qrLabel}
        </div>

        {data.logo || brand.logo ? (
          <div className="cs-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.logo || brand.logo}
              alt={data.logo ? "Logo" : brand.name}
            />
          </div>
        ) : (
          <div className="cs-logo-text">{brand.name}</div>
        )}
      </div>
    </div>
  );
}
