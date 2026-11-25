"use client";
/* PROTOTYPE ONLY — shared editor shell with product-specific control panels. */
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import type { Design as StampDesign, Item as StampItem, Shape } from "@/components/marketing/StampMaker";
import type { CardData, GroupData, GroupMember } from "@/lib/types";
import type { SignatureData } from "@/lib/email-signature";
import { QR_EXTRA, QR_PURPOSES, fullDate, kindInfo, newId, qrPayload, type Asset, type AssetOf, type PrintData, type QrData } from "./data";
import { FORMATS, SURFACES, Surfaced, type Surface } from "./renderers";
import { BigArt, KindIcon, Zoom } from "./ui";

type Props = {
  asset: Asset; all: Asset[];
  onSave: (a: Asset) => void; onBack: () => void; onDuplicate: () => void; onTrash: () => void; onFavorite: () => void;
  onDownload: (a: Asset, format: string, root: HTMLElement | null) => void;
};

export default function Editor({ asset, all, onSave, onBack, onDuplicate, onTrash, onFavorite, onDownload }: Props) {
  const [draft, setDraft] = useState<Asset>(() => structuredClone(asset));
  const [surface, setSurface] = useState<Surface>(SURFACES[asset.kind][0].key);
  const [zoom, setZoom] = useState(1);
  const [format, setFormat] = useState(FORMATS[asset.kind][0].key);
  const [tab, setTab] = useState<"edit" | "preview" | "details">("edit");
  const [leaving, setLeaving] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const dirty = JSON.stringify({ ...draft, favorite: 0, openedAt: 0 }) !== JSON.stringify({ ...asset, favorite: 0, openedAt: 0 });
  const info = kindInfo(asset.kind);

  const save = () => { if (!draft.name.trim()) return; onSave({ ...draft, favorite: asset.favorite } as Asset); };
  const saveRef = useRef(save);
  useEffect(() => { saveRef.current = save; });
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") { e.preventDefault(); saveRef.current(); } };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const setData = <K extends Asset["kind"]>(fn: (d: AssetOf<K>["data"]) => AssetOf<K>["data"]) =>
    setDraft((a) => ({ ...a, data: fn(a.data as AssetOf<K>["data"]) }) as Asset);
  const back = () => (dirty ? setLeaving(true) : onBack());

  return (
    <div className="pt-editor">
      <header className="pt-ed-top">
        <button className="pt-btn pt-btn-ghost" onClick={back}>← My designs</button>
        <span className="pt-type-inline"><KindIcon kind={asset.kind} size={12} />{info.label}</span>
        <input className="pt-ed-name" value={draft.name} maxLength={120} aria-label="Design name" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
        <span className={`pt-save-state ${dirty ? "is-dirty" : ""}`}>{dirty ? "Unsaved changes" : `Saved · ${fullDate(asset.updatedAt)}`}</span>
        <div className="pt-ed-actions">
          <button className="pt-btn" onClick={onFavorite} aria-pressed={asset.favorite}>{asset.favorite ? "★ Favourite" : "☆ Favourite"}</button>
          <button className="pt-btn" onClick={onDuplicate} disabled={dirty} title={dirty ? "Save first, then duplicate" : "Make a copy to create a variation"}>Duplicate</button>
          <button className="pt-btn pt-btn-primary" onClick={save} disabled={!dirty || !draft.name.trim()}>Save <kbd>⌘S</kbd></button>
        </div>
      </header>
      {leaving && (
        <div className="pt-leave" role="alert">
          <span>You have unsaved changes to “{draft.name}”.</span>
          <button className="pt-btn pt-btn-primary pt-btn-small" onClick={() => { save(); onBack(); }}>Save and leave</button>
          <button className="pt-btn pt-btn-small" onClick={onBack}>Discard changes</button>
          <button className="pt-btn pt-btn-ghost pt-btn-small" onClick={() => setLeaving(false)}>Keep editing</button>
        </div>
      )}

      <div className="pt-ed-tabs" role="tablist">
        {(["edit", "preview", "details"] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{{ edit: "Edit", preview: "Preview", details: "Details & export" }[t]}</button>)}
      </div>

      <div className="pt-ed-cols" data-tab={tab}>
        <aside className="pt-ed-left" aria-label="Customise">
          {draft.kind === "stamp" && <StampControls d={draft.data} set={(fn) => setData<"stamp">(fn)} />}
          {draft.kind === "card" && <CardControls d={draft.data} set={(fn) => setData<"card">(fn)} />}
          {draft.kind === "qr" && <QrControls d={draft.data} set={(fn) => setData<"qr">(fn)} />}
          {draft.kind === "signature" && <SignatureControls d={draft.data} set={(fn) => setData<"signature">(fn)} />}
          {draft.kind === "group" && <TeamControls d={draft.data} set={(fn) => setData<"group">(fn)} />}
          {draft.kind === "print" && <PrintControls d={draft.data} all={all} set={(fn) => setData<"print">(fn)} />}
        </aside>

        <section className="pt-ed-center" aria-label="Live preview">
          <div className="pt-stagebar">
            <div className="pt-seg" role="group" aria-label="Preview surface">
              {SURFACES[asset.kind].map((s) => <button key={s.key} aria-pressed={surface === s.key} onClick={() => setSurface(s.key)}>{s.label}</button>)}
            </div>
            <span className="pt-live">● Live preview</span>
            <Zoom zoom={zoom} setZoom={setZoom} />
          </div>
          <div className={`pt-stage pt-stage-editor ${surface === "transparent" ? "pt-checker" : ""}`} ref={stage}>
            <div className="pt-stage-inner" style={{ transform: `scale(${zoom})` }} data-kind={asset.kind}>
              <Surfaced surface={surface} kind={draft.kind} name={draft.name}><BigArt asset={draft} all={all} /></Surfaced>
            </div>
          </div>
          <p className="pt-stage-note">{STAGE_NOTE[asset.kind]}</p>
        </section>

        <aside className="pt-ed-right" aria-label="Details and export">
          <Section title="Design details">
            <Field label="Design name" hint={asset.kind === "stamp" ? "For finding it in My designs. Not printed on the stamp." : "Only you see this name."}>
              <input value={draft.name} maxLength={120} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
            </Field>
            <dl className="pt-dl">
              <dt>Type</dt><dd>{info.label}</dd>
              <dt>Template</dt><dd>{asset.templateName}</dd>
              <dt>Created</dt><dd>{fullDate(asset.createdAt)}</dd>
              <dt>Last saved</dt><dd>{fullDate(asset.updatedAt)}</dd>
              {draft.kind === "stamp" && <><dt>Output</dt><dd>1500 × 1500 px, transparent</dd></>}
              {draft.kind === "card" && <><dt>Print size</dt><dd>85 × 55 mm</dd></>}
              {draft.kind === "qr" && <><dt>A scan opens</dt><dd className="pt-mono">{qrPayload(draft.data).replace(/\r\n/g, " · ")}</dd></>}
            </dl>
          </Section>
          <Section title={draft.kind === "signature" ? "Use it" : "Download"}>
            {dirty && <p className="pt-hint pt-warn">Downloads use what you see now. Save to keep these changes in My designs.</p>}
            <div className="pt-radio-list">
              {FORMATS[asset.kind].map((f) => (
                <label key={f.key}><input type="radio" name="format" checked={format === f.key} onChange={() => setFormat(f.key)} />{f.label}</label>
              ))}
            </div>
            <button className="pt-btn pt-btn-primary pt-wide" onClick={() => onDownload(draft, format, stage.current)}>{format === "copy" ? "Copy signature" : "Download"}</button>
          </Section>
          <Section title="Manage" open={false}>
            <div className="pt-stack">
              <button className="pt-btn" onClick={onDuplicate} disabled={dirty}>Duplicate as a variation</button>
              <button className="pt-btn pt-btn-danger-ghost" onClick={onTrash}>Move to Trash…</button>
            </div>
          </Section>
          {(draft.kind === "stamp" || draft.kind === "signature") && <p className="pt-legal">Only use names, seals and signatures you are authorised to apply. A stamp image is a visual mark, not a verified electronic signature.</p>}
        </aside>
      </div>
    </div>
  );
}

const STAGE_NOTE: Record<Asset["kind"], string> = {
  stamp: "Drag-to-position stays available in the full editor. The checkerboard shows where the PNG is transparent.",
  card: "The card QR here encodes an offline vCard snapshot. A published card can use a dynamic profile link instead.",
  qr: "Point a phone camera at the screen to test it. Logos switch the code to high error correction.",
  signature: "Shown inside a typical email. Gmail and Outlook render the same table markup.",
  group: "Recipients download every contact in one .vcf file.",
  print: "Parts render from the linked designs, so editing a stamp or card updates every package that uses it.",
};

// ------------------------------------------------------------------ shared controls

function Section({ title, children, open = true }: { title: string; children: ReactNode; open?: boolean }) {
  return <details className="pt-section" open={open}><summary>{title}</summary><div>{children}</div></details>;
}
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return <label className="pt-field"><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}
const INKS = ["#1d4ed8", "#1e3a8a", "#15803d", "#b91c1c", "#dc2626", "#7c2d12", "#6d28d9", "#0f172a"];
function Swatches({ value, onChange, colors = INKS }: { value: string; onChange: (c: string) => void; colors?: string[] }) {
  return (
    <div className="pt-swatches">
      {colors.map((c) => <button key={c} type="button" style={{ background: c }} aria-pressed={value.toLowerCase() === c} aria-label={`Colour ${c}`} onClick={() => onChange(c)} />)}
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} aria-label="Custom colour" />
    </div>
  );
}
function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { key: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return <div className="pt-seg pt-seg-full" role="group" aria-label={label}>{options.map((o) => <button type="button" key={o.key} aria-pressed={value === o.key} onClick={() => onChange(o.key)}>{o.label}</button>)}</div>;
}
function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
  return <label className="pt-toggle"><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span><b>{label}</b>{hint && <small>{hint}</small>}</span></label>;
}

// ------------------------------------------------------------------ stamp

const SHAPES: Shape[] = ["Circle", "Oval", "Rectangle", "Square", "Shield", "Hexagon", "Octagon", "Triangle"];
const PLACES: { key: StampItem["place"]; label: string }[] = [{ key: "top", label: "Top" }, { key: "center", label: "Centre" }, { key: "bottom", label: "Bottom" }];
function today(fmt: StampDesign["dateFormat"]) {
  const d = new Date(), dd = String(d.getDate()).padStart(2, "0"), mm = String(d.getMonth() + 1).padStart(2, "0"), yyyy = d.getFullYear();
  const mon = d.toLocaleString("en-GB", { month: "short" }).toUpperCase();
  return fmt === "YYYY-MM-DD" ? `${yyyy}-${mm}-${dd}` : fmt === "DD MMM YYYY" ? `${dd} ${mon} ${yyyy}` : fmt === "MMM DD, YYYY" ? `${mon} ${dd}, ${yyyy}` : `${dd}/${mm}/${yyyy}`;
}

function StampControls({ d, set }: { d: StampDesign; set: (fn: (d: StampDesign) => StampDesign) => void }) {
  const lines = d.items.filter((i) => !i.imageData && !i.id.startsWith("x-"));
  const date = d.items.find((i) => i.id === "x-date");
  const serial = d.items.find((i) => i.id === "x-serial");
  const item = (id: string, p: Partial<StampItem>) => set((x) => ({ ...x, items: x.items.map((i) => (i.id === id ? { ...i, ...p } : i)) }));
  const extra = (id: string, on: boolean, text: string) => set((x) => ({ ...x, items: on ? [...x.items.filter((i) => i.id !== id), { id, text, place: "center", size: id === "x-date" ? 12 : 9, bold: id === "x-date", font: "Arial", color: id === "x-date" ? "#dc2626" : x.color, letterSpacing: 0 }] : x.items.filter((i) => i.id !== id) }));
  return (
    <>
      <div className="pt-callout"><b>Stamp text is what gets printed.</b> The design name (top bar) is only for finding this stamp later.</div>
      <Section title="Stamp text">
        {lines.map((l) => (
          <div key={l.id} className="pt-line">
            <input value={l.text} maxLength={l.curved ? 40 : 64} aria-label="Stamp text line" onChange={(e) => item(l.id, { text: e.target.value.toUpperCase() })} />
            <div className="pt-line-row">
              <select value={l.place} aria-label="Position" onChange={(e) => item(l.id, { place: e.target.value as StampItem["place"], curved: e.target.value !== "center" && l.curved })}>
                {PLACES.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
              {l.place !== "center" && <label className="pt-mini"><input type="checkbox" checked={!!l.curved} onChange={(e) => item(l.id, { curved: e.target.checked })} />Curve</label>}
              <label className="pt-mini">Size<input type="number" min={6} max={36} value={l.size} onChange={(e) => item(l.id, { size: Math.min(36, Math.max(6, +e.target.value || 6)) })} /></label>
              <label className="pt-mini"><input type="checkbox" checked={l.bold} onChange={(e) => item(l.id, { bold: e.target.checked })} />Bold</label>
              <button type="button" className="pt-icon-btn" aria-label={`Remove line ${l.text}`} onClick={() => set((x) => ({ ...x, items: x.items.filter((i) => i.id !== l.id) }))}>×</button>
            </div>
          </div>
        ))}
        <button type="button" className="pt-btn pt-btn-small" disabled={d.items.length >= 24} onClick={() => set((x) => ({ ...x, items: [...x.items, { id: newId(), text: "NEW LINE", place: "center", size: 12, bold: true, font: "Arial", color: x.color, letterSpacing: 0 }] }))}>+ Add line</button>
      </Section>
      <Section title="Shape & ink">
        <div className="pt-shapes">
          {SHAPES.map((s) => <button type="button" key={s} aria-pressed={d.shape === s} onClick={() => set((x) => ({ ...x, shape: s }))}>{s}</button>)}
        </div>
        <Field label="Ink colour"><Swatches value={d.color} onChange={(c) => set((x) => ({ ...x, color: c, items: x.items.map((i) => (i.id === "x-date" ? i : { ...i, color: c })) }))} /></Field>
        <Field label={`Border weight · ${d.border}`}><input type="range" min={1} max={12} value={d.border} onChange={(e) => set((x) => ({ ...x, border: +e.target.value }))} /></Field>
        <Field label="Border style">
          <select value={d.borderStyle} onChange={(e) => set((x) => ({ ...x, borderStyle: e.target.value }))}>
            {["Double ring", "Single ring", "Dotted, office", "Serrated, notary"].map((b) => <option key={b}>{b}</option>)}
          </select>
        </Field>
      </Section>
      <Section title="Date, serial & finish" open={false}>
        <Toggle checked={!!date} label="Add today’s date" hint="Updated to the download day in the full product." onChange={(on) => extra("x-date", on, today(d.dateFormat))} />
        {date && <Field label="Date format"><select value={d.dateFormat} onChange={(e) => { const f = e.target.value as StampDesign["dateFormat"]; set((x) => ({ ...x, dateFormat: f, items: x.items.map((i) => (i.id === "x-date" ? { ...i, text: today(f) } : i)) })); }}>{(["DD/MM/YYYY", "DD MMM YYYY", "MMM DD, YYYY", "YYYY-MM-DD"] as const).map((f) => <option key={f}>{f}</option>)}</select></Field>}
        <Toggle checked={!!serial} label="Add a serial number" onChange={(on) => extra("x-serial", on, "No. 0001")} />
        {serial && <Field label="Serial"><input value={serial.text} maxLength={20} onChange={(e) => item("x-serial", { text: e.target.value })} /></Field>}
        <Field label={`Worn ink effect · ${d.aging}%`}><input type="range" min={0} max={80} value={d.aging} onChange={(e) => set((x) => ({ ...x, aging: +e.target.value }))} /></Field>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ business card

async function smallImage(file: File, max = 320): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const s = Math.min(1, max / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL("image/png");
  } finally { URL.revokeObjectURL(url); }
}

function CardControls({ d, set }: { d: CardData; set: (fn: (d: CardData) => CardData) => void }) {
  const f = (k: keyof CardData) => (e: ChangeEvent<HTMLInputElement>) => set((x) => ({ ...x, [k]: e.target.value }));
  const img = (k: "photo" | "logo") => async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = await smallImage(file);
    set((x) => ({ ...x, [k]: data })); // merge into current state, not a stale copy
  };
  const mode = d.appearance?.mode || "logo";
  return (
    <>
      <Section title="Person">
        <div className="pt-two"><Field label="First name"><input value={d.firstName} onChange={f("firstName")} /></Field><Field label="Last name"><input value={d.lastName} onChange={f("lastName")} /></Field></div>
        <Field label="Job title"><input value={d.title} onChange={f("title")} /></Field>
        <Field label="Photo"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={img("photo")} /></Field>
        {d.photo && <button type="button" className="pt-link" onClick={() => set((x) => ({ ...x, photo: "" }))}>Remove photo</button>}
      </Section>
      <Section title="Company">
        <Field label="Organisation"><input value={d.organization} onChange={f("organization")} /></Field>
        <Field label="Tagline"><input value={d.tagline} onChange={f("tagline")} /></Field>
        <Field label="Logo"><input type="file" accept="image/png,image/jpeg,image/webp" onChange={img("logo")} /></Field>
      </Section>
      <Section title="Contact details">
        <Field label="Phone"><input value={d.phones[0]?.value || ""} onChange={(e) => set((x) => ({ ...x, phones: [{ type: x.phones[0]?.type || "CELL", value: e.target.value }, ...x.phones.slice(1)] }))} /></Field>
        <Field label="Email"><input type="email" value={d.emails[0] || ""} onChange={(e) => set((x) => ({ ...x, emails: [e.target.value, ...x.emails.slice(1)] }))} /></Field>
        <Field label="Website"><input value={d.websites[0] || ""} onChange={(e) => set((x) => ({ ...x, websites: [e.target.value, ...x.websites.slice(1)] }))} /></Field>
        <Field label="Location"><input value={d.location} onChange={f("location")} /></Field>
        <Field label="LinkedIn"><input value={d.socials.linkedin || ""} placeholder="https://linkedin.com/in/…" onChange={(e) => set((x) => ({ ...x, socials: { ...x.socials, linkedin: e.target.value } }))} /></Field>
      </Section>
      <Section title="Style">
        <Field label="Orientation"><Seg label="Orientation" value={d.orientation || "landscape"} options={[{ key: "landscape", label: "Landscape" }, { key: "portrait", label: "Portrait" }]} onChange={(v) => set((x) => ({ ...x, orientation: v }))} /></Field>
        <Field label="Colours"><Seg label="Colour source" value={mode} options={[{ key: "logo", label: "From logo" }, { key: "theme", label: "Theme" }, { key: "custom", label: "Custom" }]} onChange={(m) => set((x) => ({ ...x, appearance: { mode: m, primary: x.appearance?.primary || "#1f3a8a", secondary: x.appearance?.secondary || "#0ea5e9" } }))} /></Field>
        {mode === "custom" && <>
          <Field label="Primary"><Swatches value={d.appearance?.primary || "#1f3a8a"} onChange={(c) => set((x) => ({ ...x, appearance: { ...x.appearance!, mode: "custom", primary: c } }))} colors={["#1f3a8a", "#0f172a", "#15803d", "#7c2d12", "#6d28d9"]} /></Field>
          <Field label="Accent"><Swatches value={d.appearance?.secondary || "#0ea5e9"} onChange={(c) => set((x) => ({ ...x, appearance: { ...x.appearance!, mode: "custom", secondary: c } }))} colors={["#0ea5e9", "#f59e0b", "#22c55e", "#ef4444", "#a855f7"]} /></Field>
        </>}
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ QR

function QrControls({ d, set }: { d: QrData; set: (fn: (d: QrData) => QrData) => void }) {
  const p = QR_PURPOSES.find((x) => x.key === d.purpose)!;
  return (
    <>
      <Section title="What should a scan open?">
        <div className="pt-purposes">
          {QR_PURPOSES.map((x) => <button type="button" key={x.key} aria-pressed={d.purpose === x.key} onClick={() => set((q) => ({ ...q, purpose: x.key, value: q.purpose === x.key ? q.value : x.placeholder, extra: "" }))}>{x.label}</button>)}
        </div>
        <Field label={p.field}><input value={d.value} placeholder={p.placeholder} onChange={(e) => set((q) => ({ ...q, value: e.target.value }))} /></Field>
        {QR_EXTRA[d.purpose] && <Field label={QR_EXTRA[d.purpose]!}><input value={d.extra} onChange={(e) => set((q) => ({ ...q, extra: e.target.value }))} /></Field>}
      </Section>
      <Section title="Design">
        <Field label="Caption under the code"><input value={d.caption} maxLength={60} onChange={(e) => set((q) => ({ ...q, caption: e.target.value }))} /></Field>
        <Field label="Colour"><Swatches value={d.color} onChange={(c) => set((q) => ({ ...q, color: c }))} colors={["#17141c", "#1f3a8a", "#0f5132", "#7c2d12", "#6d28d9"]} /></Field>
        <Toggle checked={d.logo} onChange={(v) => set((q) => ({ ...q, logo: v }))} label="Logo in the centre" hint="Uses your brand icon." />
      </Section>
      <Section title="Behaviour" open={false}>
        <Seg label="QR behaviour" value={d.mode} options={[{ key: "dynamic", label: "Editable link" }, { key: "static", label: "Fixed" }]} onChange={(m) => set((q) => ({ ...q, mode: m }))} />
        <p className="pt-hint">{d.mode === "dynamic" ? "Printed codes keep working when you change the destination later. Needs a free account." : "The content is baked into the code. Changing it means printing a new code."}</p>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ signature

function SignatureControls({ d, set }: { d: SignatureData; set: (fn: (d: SignatureData) => SignatureData) => void }) {
  const f = (k: keyof SignatureData) => (e: ChangeEvent<HTMLInputElement>) => set((x) => ({ ...x, [k]: e.target.value }));
  return (
    <>
      <Section title="Your details">
        <Field label="Name"><input value={d.name} onChange={f("name")} /></Field>
        <div className="pt-two"><Field label="Job title"><input value={d.title} onChange={f("title")} /></Field><Field label="Company"><input value={d.company} onChange={f("company")} /></Field></div>
        <Field label="Email"><input value={d.email} onChange={f("email")} /></Field>
        <Field label="Phone"><input value={d.phone} onChange={f("phone")} /></Field>
        <Field label="Website"><input value={d.website} onChange={f("website")} /></Field>
      </Section>
      <Section title="Style">
        <Field label="Layout"><Seg label="Layout" value={d.layout === "stacked" ? "stacked" : "classic"} options={[{ key: "classic", label: "Classic" }, { key: "stacked", label: "Stacked" }]} onChange={(v) => set((x) => ({ ...x, layout: v }))} /></Field>
        <Field label="Accent colour"><Swatches value={d.color} onChange={(c) => set((x) => ({ ...x, color: c }))} colors={["#596b48", "#1f3a8a", "#0f172a", "#7c2d12", "#6d28d9"]} /></Field>
        <Field label="Font"><select value={d.font} onChange={(e) => set((x) => ({ ...x, font: e.target.value }))}>{["Arial", "Georgia", "Verdana"].map((x) => <option key={x}>{x}</option>)}</select></Field>
      </Section>
      <Section title="Social links" open={false}>
        {(["linkedin", "twitter", "instagram"] as const).map((k) => (
          <Field key={k} label={{ linkedin: "LinkedIn", twitter: "X", instagram: "Instagram" }[k]}><input value={d.socials[k] || ""} placeholder="https://…" onChange={(e) => set((x) => ({ ...x, socials: { ...x.socials, [k]: e.target.value } }))} /></Field>
        ))}
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ team

function TeamControls({ d, set }: { d: GroupData; set: (fn: (d: GroupData) => GroupData) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const member = (i: number, p: Partial<GroupMember>) => set((x) => ({ ...x, members: x.members.map((m, j) => (j === i ? { ...m, ...p } : m)) }));
  const shown = d.members.map((m, i) => ({ m, i })).filter(({ m }) => `${m.firstName} ${m.lastName} ${m.title}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <>
      <Section title="Team">
        <Field label="Team name"><input value={d.name} onChange={(e) => set((x) => ({ ...x, name: e.target.value }))} /></Field>
        <Field label="Organisation"><input value={d.organization} onChange={(e) => set((x) => ({ ...x, organization: e.target.value }))} /></Field>
        <Field label="Message on the page"><input value={d.tagline} onChange={(e) => set((x) => ({ ...x, tagline: e.target.value }))} /></Field>
      </Section>
      <Section title={`Members · ${d.members.length}`}>
        <input className="pt-input-search" type="search" placeholder="Search members" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search members" />
        <ul className="pt-members">
          {shown.map(({ m, i }) => (
            <li key={i}>
              <button type="button" className="pt-member-head" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
                <span className="pt-avatar">{(m.firstName[0] || "?") + (m.lastName[0] || "")}</span>
                <span><b>{m.firstName || "New"} {m.lastName}</b><small>{m.title || "No title"}</small></span>
              </button>
              {open === i && (
                <div className="pt-member-edit">
                  <div className="pt-two"><input aria-label="First name" placeholder="First name" value={m.firstName} onChange={(e) => member(i, { firstName: e.target.value })} /><input aria-label="Last name" placeholder="Last name" value={m.lastName} onChange={(e) => member(i, { lastName: e.target.value })} /></div>
                  <input aria-label="Title" placeholder="Title" value={m.title} onChange={(e) => member(i, { title: e.target.value })} />
                  <input aria-label="Phone" placeholder="Phone" value={m.phone} onChange={(e) => member(i, { phone: e.target.value })} />
                  <input aria-label="Email" placeholder="Email" value={m.email} onChange={(e) => member(i, { email: e.target.value })} />
                  <button type="button" className="pt-link pt-danger" onClick={() => { set((x) => ({ ...x, members: x.members.filter((_, j) => j !== i) })); setOpen(null); }}>Remove from team</button>
                </div>
              )}
            </li>
          ))}
          {shown.length === 0 && <li className="pt-muted">No members match.</li>}
        </ul>
        <button type="button" className="pt-btn pt-btn-small" onClick={() => { set((x) => ({ ...x, members: [...x.members, { firstName: "", lastName: "", title: "", organization: "", phone: "", email: "" }] })); setOpen(d.members.length); setQ(""); }}>+ Add member</button>
        <p className="pt-hint">CSV import stays available for larger teams.</p>
      </Section>
    </>
  );
}

// ------------------------------------------------------------------ print package

function PrintControls({ d, all, set }: { d: PrintData; all: Asset[]; set: (fn: (d: PrintData) => PrintData) => void }) {
  const opts = (k: Asset["kind"]) => all.filter((a) => a.kind === k && !a.deletedAt);
  const part = (key: keyof PrintData["parts"], idKey: "cardId" | "qrId" | "stampId", kind: Asset["kind"], label: string) => (
    <div className="pt-part">
      <Toggle checked={d.parts[key]} onChange={(v) => set((x) => ({ ...x, parts: { ...x.parts, [key]: v } }))} label={label} />
      {d.parts[key] && (
        <select value={d[idKey]} aria-label={`${label} source`} onChange={(e) => set((x) => ({ ...x, [idKey]: e.target.value }))}>
          <option value="">Choose from My designs…</option>
          {opts(kind).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
      )}
    </div>
  );
  return (
    <>
      <div className="pt-callout">A package links to designs you already saved. Change the card once and every package stays current.</div>
      <Section title="Contents">
        {part("card", "cardId", "card", "Business card")}
        {part("qr", "qrId", "qr", "QR code sheet")}
        {part("stamp", "stampId", "stamp", "Company stamp")}
      </Section>
      <Section title="Paper">
        <Seg label="Paper size" value={d.paper} options={[{ key: "A4", label: "A4" }, { key: "Letter", label: "US Letter" }]} onChange={(v) => set((x) => ({ ...x, paper: v }))} />
        <p className="pt-hint">Production packages add 3 mm bleed, crop marks and a print-ready PDF (existing print service).</p>
      </Section>
    </>
  );
}
