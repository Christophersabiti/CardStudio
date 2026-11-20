"use client";
import { useAdminAction } from "./useAdminAction";

const labels: Record<string, [string, string]> = {
  cards: ["Business cards", "The card builder at /studio."],
  groups: ["Team contacts", "Group contact bundles in the studio."],
  qr_codes: ["QR codes", "Creating and editing dynamic QR codes in QR Studio."],
  email_signature: ["Email signature", "The email signature builder."],
  stamps: ["E-stamp maker", "Designing and exporting stamps."],
  print_package: ["Print package", "Downloading print-ready files."],
};

export default function FeatureAdmin({ flags }: { flags: { key: string; enabled: boolean; updated_at: string }[] }) {
  const { busy, message, run } = useAdminAction();
  return (
    <>
      {message && <p role={message.error ? "alert" : "status"} className={`admin-message${message.error ? " is-error" : ""}`}>{message.text}</p>}
      <p className="cs-panel mb-5 text-sm">
        Switching a product off hides it from the menu and the Create page and stops new work in it. Cards, QR codes and other items that are already published keep working.
      </p>
      <ul className="admin-features">
        {flags.map((f) => (
          <li key={f.key} className="admin-card">
            <div>
              <strong>{labels[f.key]?.[0] || f.key}</strong>
              <small>{labels[f.key]?.[1]}</small>
              <small>Last changed {new Date(f.updated_at).toLocaleString("en-GB")}</small>
            </div>
            <label className="admin-switch">
              <input
                type="checkbox"
                role="switch"
                checked={f.enabled}
                disabled={busy}
                onChange={(e) => void run({ action: "feature", body: { key: f.key, enabled: e.target.checked } }, `${labels[f.key]?.[0] || f.key} is now ${e.target.checked ? "on" : "off"}.`)}
              />
              <span>{f.enabled ? "On" : "Off"}</span>
            </label>
          </li>
        ))}
      </ul>
    </>
  );
}
