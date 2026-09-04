"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Brand } from "@/lib/brand";
import type { CardData } from "@/lib/types";
import { buildVcard, contactFileBase } from "@/lib/vcard";
import { qrDataUrl } from "@/lib/qr";
import BuilderForm from "./BuilderForm";
import CardPreview from "./CardPreview";
import CardActions from "./CardActions";

const DRAFT_KEY = "card_studio_draft_v1";

const SAMPLE: CardData = {
  firstName: "Christopher",
  lastName: "Sabiti",
  title: "Founder & Chief Trainer",
  organization: "Sabtech Online",
  phones: [
    { type: "CELL", value: "+256 700 000 000" },
    { type: "WORK", value: "+256 414 000 000" },
  ],
  emails: ["hello@sabtechonline.com"],
  websites: ["https://sabtechonline.com"],
  socials: { linkedin: "https://linkedin.com/in/christopher-sabiti" },
  location: "Kampala, Uganda",
  tagline: "Building data & technology learning across Africa.",
  role: "",
  accent: "secondary",
  photo: "",
};

export default function Studio({ brand }: { brand: Brand }) {
  const [data, setData] = useState<CardData>(SAMPLE);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const debounce = useRef<number | undefined>(undefined);

  // load any saved draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setData({ ...SAMPLE, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const vcard = useMemo(() => buildVcard(data), [data]);

  // regenerate QR + persist draft (debounced) whenever the card changes
  useEffect(() => {
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
    window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => {
      qrDataUrl(vcard, { width: 512 }).then(setQrUrl).catch(() => setQrUrl(""));
    }, 150);
    return () => window.clearTimeout(debounce.current);
  }, [data, vcard]);

  async function save() {
    setSaving(true);
    setError("");
    setShareUrl("");
    try {
      const res = await fetch("/api/cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save card");
      setShareUrl(`${window.location.origin}/c/${json.slug}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-[1240px] mx-auto px-5 pb-16">
      <div className="cs-studio-grid">
        <div className="cs-editor-col">
          <BuilderForm data={data} setData={setData} />
        </div>

        <div className="flex flex-col gap-4 lg:sticky lg:top-5 cs-stage-col">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[15px] font-extrabold tracking-tight">Live preview</h2>
            <span className="text-xs" style={{ color: "var(--muted)" }}>Updates as you type</span>
          </div>

          <div
            className="rounded-2xl border p-6 grid place-items-center"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <div className="cs-print">
              <CardPreview data={data} qrUrl={qrUrl} brand={brand} />
            </div>
          </div>

          <CardActions vcard={vcard} qrUrl={qrUrl} fileBase={contactFileBase(data)} />

          {/* Save & share */}
          <div
            className="rounded-2xl border p-4 flex flex-col gap-3"
            style={{ background: "var(--surface)", borderColor: "var(--line)" }}
          >
            <button
              onClick={save}
              disabled={saving}
              className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
              style={{ background: "var(--brand-secondary)" }}
            >
              {saving ? "Saving…" : "Save & get shareable link"}
            </button>

            {shareUrl ? (
              <div className="flex flex-col gap-2">
                <div className="flex gap-2">
                  <input
                    readOnly
                    value={shareUrl}
                    className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm border font-mono"
                    style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
                    onFocus={(e) => e.currentTarget.select()}
                  />
                  <button
                    onClick={() => navigator.clipboard.writeText(shareUrl)}
                    className="rounded-lg px-3 py-2.5 text-sm font-semibold border"
                    style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
                  >
                    Copy
                  </button>
                </div>
                <a
                  href={shareUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold"
                  style={{ color: "var(--brand-primary-deep)" }}
                >
                  Open your public card →
                </a>
              </div>
            ) : null}

            {error ? (
              <p className="text-sm" style={{ color: "#c0392b" }}>{error}</p>
            ) : null}
            <p className="text-[11.5px]" style={{ color: "var(--faint)" }}>
              Saving stores this card in Supabase and gives it a permanent public link with its own QR.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
