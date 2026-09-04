import type { CardData } from "@/lib/types";
import type { Brand } from "@/lib/brand";
import { SOCIALS } from "@/lib/socials";
import { PhoneIcon, MailIcon, WebIcon, PinIcon, ScanIcon } from "./icons";

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
}: {
  data: CardData;
  qrUrl: string;
  brand: Brand;
}) {
  const name = `${data.firstName || ""} ${data.lastName || ""}`.trim();
  const phones = data.phones.filter((p) => p.value).slice(0, 3);
  const email = data.emails.find((e) => e);
  const website = data.websites.find((w) => w);

  return (
    <div className="cs-card">
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
            {data.organization ? <div className="cs-org">{data.organization}</div> : null}
          </div>
        </div>

        <div className="cs-contact">
          {phones.map((p, i) => (
            <div className="cs-line" key={`p${i}`}>
              <span className="cs-ic"><PhoneIcon /></span>
              <span>{p.value}</span>
            </div>
          ))}
          {email ? (
            <div className="cs-line">
              <span className="cs-ic"><MailIcon /></span>
              <span>{email}</span>
            </div>
          ) : null}
          {website ? (
            <div className="cs-line">
              <span className="cs-ic"><WebIcon /></span>
              <span>{stripUrl(website)}</span>
            </div>
          ) : null}
        </div>

        <div className="cs-socials">
          {SOCIALS.filter((s) => data.socials[s.key]).map((s) => (
            <a
              key={s.key}
              className="cs-badge"
              href={data.socials[s.key]}
              target="_blank"
              rel="noopener noreferrer"
              title={s.name}
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
              <span style={{ opacity: 0.85, display: "inline-flex", width: 12 }}><PinIcon /></span>
              <span>{data.location}</span>
            </div>
          ) : null}
          {data.role ? (
            <div className="pp"><b>{data.role}</b></div>
          ) : null}
          {data.tagline ? <div className="cs-tagline">{data.tagline}</div> : null}
        </div>

        <div className="cs-qr-chip">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Scan to save contact" width={128} height={128} />
          ) : (
            <div style={{ width: 128, height: 128 }} />
          )}
        </div>
        <div className="cs-qr-cta">
          <ScanIcon /> Scan to save my contact
        </div>

        {data.logo || brand.logo ? (
          <div className="cs-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={data.logo || brand.logo} alt={data.logo ? "Logo" : brand.name} />
          </div>
        ) : (
          <div className="cs-logo-text">{brand.name}</div>
        )}
      </div>
    </div>
  );
}
