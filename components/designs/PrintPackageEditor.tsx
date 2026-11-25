"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Design as StampDesign } from "@/components/marketing/StampMaker";
import type { Brand } from "@/lib/brand";
import { emptyPrintConfig, type AssetItem, type PrintConfig } from "@/lib/assets-schema";
import { downloadBlob } from "@/lib/download";
import type { CardData } from "@/lib/types";
import { CardArt, QrArt, StampArt } from "./art";
import { KindIcon } from "./Library";
import "./designs.css";

export interface PrintOptions {
  cards: { id: string; slug: string; revision: number; name: string; data: CardData; dynamic: boolean; upToDate: boolean }[];
  qrs: { id: string; slug: string; name: string; data: Record<string, unknown>; ready: boolean }[];
  stamps: { id: string; name: string; design: StampDesign }[];
}
type Saved = { id: string; name: string; revision: number; createdAt: string; updatedAt: string; config: PrintConfig };

const when = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
/** Library-shaped stand-ins so the package preview uses the same renderers as My designs. */
const item = (kind: AssetItem["kind"], p: Partial<AssetItem>): AssetItem => ({ kind, id: "", slug: null, name: "", derivedName: "", data: {}, published: false, upToDate: false, archived: false, revision: 1, createdAt: "", updatedAt: "", deletedAt: null, favorite: false, openedAt: null, ...p });

export default function PrintPackageEditor({ initial, options, brand, printAllowed }: { initial: Saved | null; options: PrintOptions; brand: Brand; printAllowed: boolean }) {
  const router = useRouter();
  const [saved, setSaved] = useState<Saved | null>(initial);
  const [id] = useState(() => initial?.id || crypto.randomUUID());
  const [name, setName] = useState(initial?.name || (options.cards[0] ? `${options.cards[0].name} print package` : "Print package"));
  const [config, setConfig] = useState<PrintConfig>(() => initial?.config || { ...emptyPrintConfig(), cardId: options.cards[0]?.id || "", qrId: options.qrs.find((q) => q.ready)?.id || "", stampId: options.stamps[0]?.id || "", parts: { card: !!options.cards[0], qr: options.qrs.some((q) => q.ready), stamp: false } });
  const [busy, setBusy] = useState<"" | "save" | "download">("");
  const [notice, setNotice] = useState<{ text: string; tone?: "error" } | null>(null);
  const [tab, setTab] = useState<"edit" | "preview" | "details">("edit");
  const opId = useRef<string>("");
  const dirty = !saved || saved.name !== name.trim() || JSON.stringify(saved.config) !== JSON.stringify(config);

  useEffect(() => {
    if (!dirty || !saved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty, saved]);

  const card = options.cards.find((c) => c.id === config.cardId);
  const qr = options.qrs.find((q) => q.id === config.qrId);
  const stamp = options.stamps.find((s) => s.id === config.stampId);
  const problems = useMemo(() => {
    const list: string[] = [];
    if (config.parts.card && !card) list.push("Choose a business card or turn that part off.");
    if (config.parts.card && card?.dynamic && !card.upToDate) list.push(`Publish the current details of “${card.name}” to print its online QR, or switch the card to an offline contact QR.`);
    if (config.parts.card && !printAllowed) list.push("Card print files are included with Basic and Premium.");
    if (config.parts.qr && !qr) list.push("Choose a QR code or turn that part off.");
    if (config.parts.qr && qr && !qr.ready) list.push(`Publish “${qr.name}” in QR Studio before adding it to a package.`);
    if (config.parts.stamp && !stamp) list.push("Choose a stamp or turn that part off.");
    if (!(config.parts.card && card) && !(config.parts.qr && qr) && !(config.parts.stamp && stamp)) list.push("Add at least one design.");
    return list;
  }, [config, card, qr, stamp, printAllowed]);

  async function save() {
    if (!name.trim()) { setNotice({ text: "Give this package a name.", tone: "error" }); return; }
    setBusy("save"); setNotice(null);
    try {
      const r = await fetch("/api/print-packages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, revision: saved?.revision, name: name.trim(), config }) });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Could not save this package.");
      const next = { id: b.design.id, name: b.design.name, revision: b.design.revision, createdAt: b.design.created_at, updatedAt: b.design.updated_at, config: b.design.config };
      setSaved(next); setName(next.name);
      if (!saved) window.history.replaceState(null, "", `/designs/print/${next.id}`);
      setNotice({ text: "Saved to My designs." });
    } catch (e) { setNotice({ text: e instanceof Error ? e.message : "Could not save this package.", tone: "error" }); }
    finally { setBusy(""); }
  }
  async function download() {
    if (!saved || dirty) return;
    setBusy("download"); setNotice(null);
    opId.current ||= crypto.randomUUID();
    try {
      const r = await fetch(`/api/print-packages/${saved.id}/download`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation_id: opId.current }) });
      if (!r.ok) { const b = await r.json().catch(() => ({})); throw Error(b.error || "Could not prepare this package."); }
      downloadBlob(`${saved.name.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "").toLowerCase() || "print-package"}.zip`, await r.blob());
      opId.current = "";
      window.dispatchEvent(new Event("card-studio-usage"));
      setNotice({ text: "Print package downloaded." });
    } catch (e) { setNotice({ text: e instanceof Error ? e.message : "Could not prepare this package.", tone: "error" }); }
    finally { setBusy(""); }
  }
  async function trash() {
    if (!saved || !confirm(`Move “${saved.name}” to Trash? You can restore it from My designs.`)) return;
    const r = await fetch(`/api/assets/print/${saved.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "trash" }) });
    if (r.ok) router.push("/designs?kind=print");
    else setNotice({ text: (await r.json()).error || "Could not move to Trash.", tone: "error" });
  }

  const part = (key: keyof PrintConfig["parts"], idKey: "cardId" | "qrId" | "stampId", label: string, list: { id: string; name: string; ready?: boolean }[], empty: { text: string; href: string }) => (
    <div className="ds-part">
      <label className="ds-toggle"><input type="checkbox" checked={config.parts[key]} onChange={(e) => setConfig((c) => ({ ...c, parts: { ...c.parts, [key]: e.target.checked } }))} /><span><b>{label}</b></span></label>
      {config.parts[key] && (list.length ? (
        <select value={config[idKey]} aria-label={`${label} from My designs`} onChange={(e) => setConfig((c) => ({ ...c, [idKey]: e.target.value }))}>
          <option value="">Choose from My designs…</option>
          {list.map((o) => <option key={o.id} value={o.id}>{o.name}{o.ready === false ? " (not published)" : ""}</option>)}
        </select>
      ) : <p className="ds-hint">{empty.text} <Link className="ds-link" href={empty.href}>Create one</Link></p>)}
    </div>
  );

  return (
    <div className="ds-editor">
      <header className="ds-ed-top">
        <Link className="ds-btn ds-btn-ghost" href="/designs?kind=print">← My designs</Link>
        <span className="ds-type-inline"><KindIcon kind="print" size={12} />Print package</span>
        <input className="ds-ed-name" value={name} maxLength={120} aria-label="Package name" onChange={(e) => setName(e.target.value)} />
        <span className={`ds-save-state ${dirty ? "is-dirty" : ""}`}>{!saved ? "Not saved yet" : dirty ? "Unsaved changes" : `Saved · ${when(saved.updatedAt)}`}</span>
        <div className="ds-ed-actions"><button className="ds-btn ds-btn-primary" onClick={() => void save()} disabled={busy !== "" || (!!saved && !dirty)}>{busy === "save" ? "Saving…" : "Save"}</button></div>
      </header>
      <div className="ds-ed-tabs" role="tablist">
        {(["edit", "preview", "details"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ edit: "Contents", preview: "Preview", details: "Download" }[t]}</button>)}
      </div>
      <div className="ds-ed-cols" data-tab={tab}>
        <aside className="ds-ed-left" aria-label="Package contents">
          <div className="ds-callout">A package links to designs you already saved. Edit the card, QR code or stamp and the package uses the latest saved version.</div>
          <details className="ds-section" open><summary>Contents</summary><div>
            {part("card", "cardId", "Business card · front, back and mockup", options.cards, { text: "No saved cards yet.", href: "/studio" })}
            {part("qr", "qrId", "QR code · PNG with caption", options.qrs.map((q) => ({ id: q.id, name: q.name, ready: q.ready })), { text: "No QR codes yet.", href: "/qr-studio" })}
            {part("stamp", "stampId", "Stamp · transparent PNG", options.stamps, { text: "No saved stamps yet.", href: "/stamp-maker" })}
          </div></details>
          <details className="ds-section" open><summary>Card print size</summary><div>
            <div className="ds-seg ds-seg-full" role="group" aria-label="Card print size">
              <button type="button" aria-pressed={config.preset === "exact"} onClick={() => setConfig((c) => ({ ...c, preset: "exact" }))}>Exact size</button>
              <button type="button" aria-pressed={config.preset === "bleed"} onClick={() => setConfig((c) => ({ ...c, preset: "bleed" }))}>With bleed</button>
            </div>
            <p className="ds-hint">Exact size is 85.6 × 54 mm. Choose bleed when your printer asks for extra edge to trim.</p>
          </div></details>
        </aside>
        <section className="ds-ed-center" aria-label="Package preview">
          <div className="ds-stage ds-stage-editor">
            <div className="ds-sheet">
              <div className="ds-sheet-head"><span>{config.preset === "bleed" ? "Card with bleed" : "Card exact size"} · {[config.parts.card && card, config.parts.qr && qr, config.parts.stamp && stamp].filter(Boolean).length} files</span></div>
              <div className="ds-sheet-grid">
                {config.parts.card && <figure data-part="card">{card ? <div className="ds-scale-card"><CardArt asset={item("card", { slug: card.slug, data: card.data as unknown as Record<string, unknown>, published: card.upToDate, upToDate: card.upToDate })} brand={brand} /></div> : <div className="ds-missing">Choose a card</div>}<figcaption>Business card · 85.6 × 54 mm</figcaption></figure>}
                {config.parts.qr && <figure data-part="qr">{qr ? <QrArt asset={item("qr", { slug: qr.slug, data: qr.data, published: qr.ready })} /> : <div className="ds-missing">Choose a QR code</div>}<figcaption>QR code · PNG</figcaption></figure>}
                {config.parts.stamp && <figure data-part="stamp">{stamp ? <StampArt design={stamp.design} /> : <div className="ds-missing">Choose a stamp</div>}<figcaption>Stamp · 1500 px, transparent</figcaption></figure>}
              </div>
            </div>
          </div>
        </section>
        <aside className="ds-ed-right" aria-label="Download">
          <details className="ds-section" open><summary>Download</summary><div>
            {problems.length > 0 && <ul className="ds-problems">{problems.map((p) => <li key={p}>{p}</li>)}</ul>}
            <button className="ds-btn ds-btn-primary ds-wide" onClick={() => void download()} disabled={busy !== "" || !saved || dirty || problems.length > 0}>{busy === "download" ? "Preparing…" : "Download package (ZIP)"}</button>
            <p className="ds-hint">{!saved ? "Save the package first." : dirty ? "Save your changes before downloading." : config.parts.stamp ? "The stamp counts toward your monthly stamp downloads." : "One ZIP with every file and a README."}</p>
            {notice && <p role="status" className={`ds-hint ${notice.tone === "error" ? "ds-danger" : ""}`}>{notice.text}</p>}
          </div></details>
          {saved && <details className="ds-section"><summary>Details</summary><div>
            <dl className="ds-dl"><dt>Created</dt><dd>{when(saved.createdAt)}</dd><dt>Last saved</dt><dd>{when(saved.updatedAt)}</dd></dl>
            <button className="ds-btn ds-btn-danger-ghost" onClick={() => void trash()}>Move to Trash…</button>
          </div></details>}
        </aside>
      </div>
    </div>
  );
}
