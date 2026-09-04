"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Brand } from "@/lib/brand";
import type { CardData, GroupData } from "@/lib/types";
import { emptyGroup } from "@/lib/types";
import { buildVcard, contactFileBase, buildGroupVcard, groupFileBase } from "@/lib/vcard";
import { qrDataUrl } from "@/lib/qr";
import BuilderForm from "./BuilderForm";
import CardPreview from "./CardPreview";
import CardActions from "./CardActions";
import GroupBuilderForm from "./GroupBuilderForm";
import GroupPreview from "./GroupPreview";
import GroupActions from "./GroupActions";

const DRAFT_KEY = "card_studio_draft_v1";
const GROUP_DRAFT_KEY = "card_studio_group_draft_v1";

const SAMPLE: CardData = {
  firstName: "Jane",
  lastName: "Doe",
  title: "Product Manager",
  organization: "Acme Inc.",
  phones: [
    { type: "CELL", value: "+1 555 010 0100" },
    { type: "WORK", value: "+1 555 010 0101" },
  ],
  emails: ["jane.doe@example.com"],
  websites: ["https://example.com"],
  socials: { linkedin: "https://linkedin.com/in/jane-doe" },
  location: "San Francisco, USA",
  tagline: "Helping teams build better products.",
  role: "",
  accent: "secondary",
  photo: "",
  logo: "",
};

type Mode = "single" | "group";

export default function Studio({ brand }: { brand: Brand }) {
  const [mode, setMode] = useState<Mode>("single");

  // ---- single card ----
  const [data, setData] = useState<CardData>(SAMPLE);
  const [qrUrl, setQrUrl] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [shareUrl, setShareUrl] = useState<string>("");
  const [error, setError] = useState<string>("");
  const debounce = useRef<number | undefined>(undefined);

  // ---- group / bulk contacts ----
  const [groupData, setGroupData] = useState<GroupData>(emptyGroup());
  const [groupQrUrl, setGroupQrUrl] = useState<string>("");
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupShareUrl, setGroupShareUrl] = useState<string>("");
  const [groupError, setGroupError] = useState<string>("");

  // load any saved drafts
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) setData({ ...SAMPLE, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem(GROUP_DRAFT_KEY);
      if (raw) setGroupData({ ...emptyGroup(), ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const vcard = useMemo(() => buildVcard(data), [data]);
  const groupVcard = useMemo(() => buildGroupVcard(groupData), [groupData]);

  // regenerate QR + persist draft (debounced) whenever the single card changes.
  // The QR encodes the vCard itself, so it works even before saving.
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

  // persist the group draft whenever it changes
  useEffect(() => {
    try {
      localStorage.setItem(GROUP_DRAFT_KEY, JSON.stringify(groupData));
    } catch {
      /* ignore */
    }
  }, [groupData]);

  // A group's QR encodes its public URL, not raw vCard data — a QR can't hold
  // many full vCards, so it only exists once the group has been saved.
  useEffect(() => {
    if (!groupShareUrl) {
      setGroupQrUrl("");
      return;
    }
    qrDataUrl(groupShareUrl, { width: 512 }).then(setGroupQrUrl).catch(() => setGroupQrUrl(""));
  }, [groupShareUrl]);

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

  async function saveGroup() {
    setGroupSaving(true);
    setGroupError("");
    setGroupShareUrl("");
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: groupData }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not save group");
      setGroupShareUrl(`${window.location.origin}/g/${json.slug}`);
    } catch (e) {
      setGroupError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setGroupSaving(false);
    }
  }

  return (
    <div className="max-w-[1240px] mx-auto px-5 pb-16">
      <div
        className="inline-flex rounded-xl border p-1 mb-5"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        {(
          [
            ["single", "Single card"],
            ["group", "Group / bulk contacts"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className="rounded-lg px-4 py-2 text-sm font-bold cursor-pointer transition"
            style={
              mode === m
                ? { background: "var(--brand-primary)", color: "#fff" }
                : { background: "transparent", color: "var(--muted)" }
            }
          >
            {label}
          </button>
        ))}
      </div>

      {mode === "single" ? (
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
      ) : (
        <div className="cs-studio-grid">
          <div className="cs-editor-col">
            <GroupBuilderForm data={groupData} setData={setGroupData} />
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
                <GroupPreview data={groupData} qrUrl={groupQrUrl} brand={brand} />
              </div>
            </div>

            <GroupActions
              vcard={groupVcard}
              qrUrl={groupQrUrl}
              fileBase={groupFileBase(groupData)}
              memberCount={groupData.members.length}
            />

            {/* Save & share */}
            <div
              className="rounded-2xl border p-4 flex flex-col gap-3"
              style={{ background: "var(--surface)", borderColor: "var(--line)" }}
            >
              <button
                onClick={saveGroup}
                disabled={groupSaving || groupData.members.length === 0}
                className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
                style={{ background: "var(--brand-secondary)" }}
              >
                {groupSaving ? "Saving…" : "Save & get shareable link"}
              </button>

              {groupShareUrl ? (
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={groupShareUrl}
                      className="flex-1 min-w-0 rounded-lg px-3 py-2.5 text-sm border font-mono"
                      style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
                      onFocus={(e) => e.currentTarget.select()}
                    />
                    <button
                      onClick={() => navigator.clipboard.writeText(groupShareUrl)}
                      className="rounded-lg px-3 py-2.5 text-sm font-semibold border"
                      style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
                    >
                      Copy
                    </button>
                  </div>
                  <a
                    href={groupShareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold"
                    style={{ color: "var(--brand-primary-deep)" }}
                  >
                    Open your public group card →
                  </a>
                </div>
              ) : null}

              {groupError ? (
                <p className="text-sm" style={{ color: "#c0392b" }}>{groupError}</p>
              ) : null}
              <p className="text-[11.5px]" style={{ color: "var(--faint)" }}>
                Saving stores this group in Supabase and gives it a public link whose QR lets anyone
                download every member as contacts in one step.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
