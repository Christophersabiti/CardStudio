import type { GroupData } from "@/lib/types";
import type { Brand } from "@/lib/brand";
import { UsersIcon, ScanIcon } from "./icons";

const MAX_VISIBLE_NAMES = 10;



function memberName(m: GroupData["members"][number]): string {
  return `${m.firstName} ${m.lastName}`.trim() || "Unnamed";
}

/**
 * Presentational group card — same visual language as CardPreview (shares its
 * .cs-card / .cs-aside CSS) but shows a roster of names instead of one
 * person's contact details. Used by both the builder preview and the public
 * group page. Before the group is published there's no public URL yet, so qrUrl
 * may be empty — the QR chip shows a placeholder in that case.
 */
export default function GroupPreview({
  data,
  qrUrl,
  brand,
}: {
  data: GroupData;
  qrUrl: string;
  brand: Brand;
}) {
  const visible = data.members.slice(0, MAX_VISIBLE_NAMES);
  const extra = data.members.length - visible.length;

  return (
    <div className="cs-card">
      <div className="cs-main">
        <div className="cs-top">
          <div className="cs-photo">
            <UsersIcon width={24} height={24} />
          </div>
          <div style={{ minWidth: 0 }}>
            <div className="cs-name">{data.name || "Your group name"}</div>
            {data.organization ? <div className="cs-title">{data.organization}</div> : null}
            <div className="cs-org">
              {data.members.length} {data.members.length === 1 ? "person" : "people"}
            </div>
          </div>
        </div>

        <div className="cs-group-list">
          {visible.length > 0 ? (
            visible.map((m, i) => (
              <span className="cs-group-chip" key={i}>
                {memberName(m)}
              </span>
            ))
          ) : (
            <span className="cs-group-empty">Upload a CSV to add people</span>
          )}
          {extra > 0 ? <span className="cs-group-chip cs-group-more">+{extra} more</span> : null}
        </div>
      </div>

      <div className="cs-aside">
        <span className="cs-kicker">Team card</span>
        <div className="cs-personal">
          {data.tagline ? <div className="cs-tagline">{data.tagline}</div> : null}
        </div>

        <div className="cs-qr-chip">
          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={qrUrl} alt="Scan to view group contacts" width={128} height={128} />
          ) : (
            <div
              style={{ width: 128, height: 128, display: "grid", placeItems: "center", textAlign: "center" }}
            >
              <span style={{ fontSize: 9.5, fontWeight: 600, color: "var(--muted)", lineHeight: 1.3 }}>
                Publish current details for a QR
              </span>
            </div>
          )}
        </div>
        <div className="cs-qr-cta">
          <ScanIcon /> Scan to view group contacts
        </div>

        {brand.logo ? (
          <div className="cs-logo">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logo} alt={brand.name} />
          </div>
        ) : (
          <div className="cs-logo-text">{brand.name}</div>
        )}
      </div>
    </div>
  );
}
