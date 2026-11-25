"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { CardIcon, CloseIcon, FolderIcon, MailIcon, PlusIcon, PrinterIcon, QrIcon, StampIcon, UsersIcon } from "@/components/icons";
import type { Brand } from "@/lib/brand";
import { assetEditHref, type AssetItem, type AssetKind, type AssetPage, type AssetSection, type AssetSort } from "@/lib/assets-schema";
import { AssetArt, publicHref } from "./art";
import { downloadAsset, downloadOptions } from "./downloads";
import "./designs.css";

export const KINDS: { key: AssetKind; label: string; plural: string; color: string; create: string; blurb: string }[] = [
  { key: "card", label: "Business card", plural: "Business cards", color: "#507bea", create: "/studio", blurb: "Contact card people save in one tap" },
  { key: "qr", label: "QR code", plural: "QR codes", color: "#16a37b", create: "/qr-studio", blurb: "Event, location, links, image or video" },
  { key: "group", label: "Team contacts", plural: "Team contacts", color: "#d9822b", create: "/studio?mode=groups", blurb: "A whole team from one link" },
  { key: "signature", label: "Email signature", plural: "Email signatures", color: "#8a5cf5", create: "/email-signature#signature-builder", blurb: "Paste into Gmail or Outlook" },
  { key: "stamp", label: "E-stamp", plural: "E-stamps", color: "#c2414b", create: "/stamp-maker", blurb: "Seals, approvals and date stamps" },
  { key: "print", label: "Print package", plural: "Print packages", color: "#4b5563", create: "/designs/print/new", blurb: "Card, QR and stamp files in one download" },
];
export const kindInfo = (k: AssetKind) => KINDS.find((x) => x.key === k)!;
const ICONS = { card: CardIcon, qr: QrIcon, group: UsersIcon, signature: MailIcon, stamp: StampIcon, print: PrinterIcon };
const LIFECYCLE: AssetKind[] = ["stamp", "signature", "print"];
const QR_TYPES: Record<string, string> = { event: "Event", location: "Location", links: "Links", image: "Image", video: "Video", url: "Website" };

export function KindIcon({ kind, size = 16 }: { kind: AssetKind; size?: number }) {
  const Icon = ICONS[kind];
  return <span className="ds-kicon" style={{ background: kindInfo(kind).color }} aria-hidden><Icon width={size} height={size} /></span>;
}

type Params = { kind: AssetKind | ""; q: string; section: AssetSection; sort: AssetSort };
type Toast = { id: number; text: string; tone?: "error"; action?: { label: string; run: () => void } };
type Confirm = { title: string; body: string; action: string; run: () => void };

const ago = (iso: string) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now"; if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60); if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24); if (d < 14) return d === 1 ? "yesterday" : `${d} days ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};
const fullDate = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
const query = (p: Params, page = 1) => new URLSearchParams(Object.entries({ kind: p.kind, q: p.q, section: p.section === "all" ? "" : p.section, sort: p.sort === "updated" ? "" : p.sort, page: page > 1 ? String(page) : "" }).filter(([, v]) => v)).toString();

function chips(a: AssetItem): string[] {
  const d = a.data as Record<string, unknown>;
  const pub = a.published ? (a.upToDate ? "Published" : "Unpublished changes") : "Private draft";
  switch (a.kind) {
    case "card": return [pub];
    case "group": return [`${Array.isArray(d.members) ? d.members.length : 0} people`, pub];
    case "qr": return [QR_TYPES[String(d.type)] || "QR", a.archived ? "Archived" : pub];
    case "stamp": return [String(d.shape || "Stamp"), "Transparent PNG"];
    case "signature": return [d.layout === "stacked" ? "Stacked" : "Classic"];
    case "print": { const p = (d.parts || {}) as Record<string, boolean>; return [`${Object.values(p).filter(Boolean).length} parts`]; }
  }
}

export default function Library({ initial, initialParams, brand, enabled }: { initial: AssetPage; initialParams: Params; brand: Brand; enabled: AssetKind[] }) {
  const router = useRouter();
  const [params, setParams] = useState<Params>(initialParams);
  const [data, setData] = useState<AssetPage>(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState(initialParams.q);
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState<AssetKind | true | null>(null);
  const [preview, setPreview] = useState<AssetItem | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const searchRef = useRef<HTMLInputElement>(null);
  const request = useRef(0);
  const duplicateIds = useRef<Record<string, string>>({});

  const toast = useCallback((text: string, opts: Omit<Toast, "id" | "text"> = {}) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.action ? 8000 : 4000);
  }, []);

  const load = useCallback(async (p: Params, nextPage = 1) => {
    const n = ++request.current;
    setLoading(true);
    try {
      const r = await fetch(`/api/assets?${query(p, nextPage)}`, { cache: "no-store" });
      const b = await r.json();
      if (!r.ok) throw Error(b.error || "Could not load your designs.");
      if (n !== request.current) return;
      setData((prev) => (nextPage > 1 ? { ...b, items: [...prev.items, ...b.items] } : b));
      setPage(nextPage);
    } catch (e) { if (n === request.current) toast(e instanceof Error ? e.message : "Could not load your designs.", { tone: "error" }); }
    finally { if (n === request.current) setLoading(false); }
  }, [toast]);

  const update = useCallback((patch: Partial<Params>) => {
    setParams((prev) => {
      const next = { ...prev, ...patch };
      const qs = query(next);
      window.history.replaceState(null, "", qs ? `/designs?${qs}` : "/designs");
      void load(next);
      return next;
    });
  }, [load]);

  // Per-viewer preference only.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => { try { if (localStorage.getItem("card-studio-designs-layout") === "list") setLayout("list"); } catch { /* ignore */ } }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { try { localStorage.setItem("card-studio-designs-layout", layout); } catch { /* ignore */ } }, [layout]);
  useEffect(() => {
    if (search === params.q) return;
    const t = setTimeout(() => update({ q: search }), 250);
    return () => clearTimeout(t);
  }, [search, params.q, update]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "/" && !(e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]")) { e.preventDefault(); searchRef.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = () => load(params, 1);
  const replaceItem = (id: string, patch: Partial<AssetItem>) => setData((d) => ({ ...d, items: d.items.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));

  async function assetPatch(a: AssetItem, body: Record<string, unknown>) {
    const r = await fetch(`/api/assets/${a.kind}/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const b = await r.json();
    if (!r.ok) throw Error(b.error || "Could not update this design.");
    return b;
  }
  /** Cards, teams and QR codes keep their own lifecycle endpoints (revision checks, unpublishing, quotas). */
  async function productAction(a: AssetItem, action: "duplicate" | "delete" | "restore" | "unpublish", revision = a.revision) {
    if (LIFECYCLE.includes(a.kind)) {
      if (action === "unpublish") throw Error("This design has no public page.");
      if (action === "duplicate") duplicateIds.current[a.id] ||= crypto.randomUUID();
      return assetPatch(a, action === "duplicate" ? { action, id: duplicateIds.current[a.id] } : { action: action === "delete" ? "trash" : action });
    }
    const base = a.kind === "qr" ? "/api/qr-codes" : a.kind === "card" ? "/api/cards" : "/api/groups";
    if (action === "duplicate") duplicateIds.current[a.id] ||= crypto.randomUUID();
    const r = await fetch(`${base}/${a.slug}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, revision, ...(action === "duplicate" ? { id: duplicateIds.current[a.id] } : {}) }) });
    const b = await r.json();
    if (!r.ok) throw Error(b.error || "Could not update this design.");
    window.dispatchEvent(new Event("card-studio-usage"));
    return b;
  }

  async function rename(a: AssetItem, name: string) {
    const clean = name.trim();
    if (!clean || clean === a.name) return;
    const before = a.name;
    replaceItem(a.id, { name: clean });
    try {
      const b = await assetPatch(a, { action: "rename", name: clean });
      replaceItem(a.id, { name: b.name });
      toast(`Renamed to “${b.name}”`, { action: { label: "Undo", run: () => void assetPatch(a, { action: "rename", name: before }).then(() => replaceItem(a.id, { name: before })).catch((e) => toast(e.message, { tone: "error" })) } });
    } catch (e) { replaceItem(a.id, { name: before }); toast(e instanceof Error ? e.message : "Could not rename.", { tone: "error" }); }
  }
  async function favorite(a: AssetItem) {
    replaceItem(a.id, { favorite: !a.favorite });
    try { await assetPatch(a, { action: "favorite", favorite: !a.favorite }); if (params.section === "favorites") void refresh(); }
    catch (e) { replaceItem(a.id, { favorite: a.favorite }); toast(e instanceof Error ? e.message : "Could not update favourites.", { tone: "error" }); }
  }
  async function duplicate(a: AssetItem) {
    try {
      const b = await productAction(a, "duplicate");
      delete duplicateIds.current[a.id];
      const href = b.record ? assetEditHref({ kind: a.kind, id: b.record.id, slug: b.record.slug }) : assetEditHref({ kind: a.kind, id: b.id, slug: null });
      await refresh();
      toast(`Copy created${b.name ? ` as “${b.name}”` : ""}.`, { action: { label: "Open", run: () => router.push(href) } });
    } catch (e) { toast(e instanceof Error ? e.message : "Could not duplicate.", { tone: "error" }); }
  }
  function trash(a: AssetItem) {
    setConfirm({
      title: `Move “${a.name}” to Trash?`,
      body: publicHref(a) ? "Its public link stops working until you restore and publish it again." : "You can restore it from Trash at any time.",
      action: "Move to Trash",
      run: async () => {
        try {
          const b = await productAction(a, "delete");
          await refresh();
          toast(`“${a.name}” moved to Trash.`, { action: { label: "Undo", run: () => void productAction(a, "restore", b.record?.revision).then(refresh).catch((e) => toast(e.message, { tone: "error" })) } });
        } catch (e) { toast(e instanceof Error ? e.message : "Could not move to Trash.", { tone: "error" }); }
      },
    });
  }
  async function restore(a: AssetItem) {
    try { await productAction(a, "restore"); await refresh(); toast(`Restored “${a.name}” as a private draft.`); }
    catch (e) { toast(e instanceof Error ? e.message : "Could not restore.", { tone: "error" }); }
  }
  function unpublish(a: AssetItem) {
    setConfirm({ title: `Unpublish “${a.name}”?`, body: "The public link stops showing it. Your saved design stays in My designs.", action: "Unpublish", run: async () => {
      try { await productAction(a, "unpublish"); await refresh(); toast("Unpublished."); } catch (e) { toast(e instanceof Error ? e.message : "Could not unpublish.", { tone: "error" }); }
    } });
  }
  async function download(a: AssetItem, format: string, stage: HTMLElement | null) {
    try { toast(await downloadAsset(a, format, stage)); } catch (e) { toast(e instanceof Error ? e.message : "Download failed.", { tone: "error" }); }
  }

  const trashMode = params.section === "trash";
  const total = Object.values(data.counts).reduce((n, v) => n + (v || 0), 0);
  const title = { all: "All designs", favorites: "Favourites", recent: "Recently used", trash: "Trash" }[params.section];
  const handlers = { onRename: rename, onFavorite: favorite, onDuplicate: duplicate, onTrash: trash, onRestore: restore, onUnpublish: unpublish, onPreview: setPreview, onDownload: download };

  return (
    <div className="ds-shell">
      <aside className="ds-side" aria-label="My designs">
        <button className="ds-btn ds-btn-primary ds-new" onClick={() => setCreating(true)}><PlusIcon width="16" height="16" /> New design</button>
        <nav className="ds-sidenav">
          {(["all", "favorites", "recent", "trash"] as AssetSection[]).map((s) => (
            <button key={s} aria-current={params.section === s ? "page" : undefined} onClick={() => update({ section: s, kind: "" })}>
              <span>{{ all: "All designs", favorites: "Favourites", recent: "Recent", trash: "Trash" }[s]}</span>
            </button>
          ))}
        </nav>
        <p className="ds-side-label">Create</p>
        <nav className="ds-sidenav ds-sidenav-kinds">
          {KINDS.filter((k) => enabled.includes(k.key)).map((k) => <Link key={k.key} href={k.create}><KindIcon kind={k.key} size={13} /><span>{k.label}</span></Link>)}
        </nav>
        <div className="ds-side-note">
          <b>QR scan statistics</b>
          <p>Opens, clicks and archived QR codes.</p>
          <Link className="ds-link" href="/dashboard/qr">Open QR statistics</Link>
        </div>
      </aside>

      <main className="ds-main" id="main-content">
        <header className="ds-head">
          <div><p className="ds-eyebrow">My designs</p><h1>{title}</h1></div>
          <div className="ds-tools">
            <label className="ds-search">
              <span className="sr-only">Search designs</span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input ref={searchRef} type="search" value={search} maxLength={120} onChange={(e) => setSearch(e.target.value)} placeholder="Search names, people, stamp text…" />
              {!search && <kbd>/</kbd>}
            </label>
            <label className="ds-select"><span className="sr-only">Sort</span>
              <select value={params.sort} onChange={(e) => update({ sort: e.target.value as AssetSort })}>
                <option value="updated">Last edited</option><option value="created">Date created</option><option value="name">Name A–Z</option>
              </select>
            </label>
            <div className="ds-seg" role="group" aria-label="Layout">
              <button aria-pressed={layout === "grid"} onClick={() => setLayout("grid")} title="Grid view"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor" /></svg><span className="sr-only">Grid</span></button>
              <button aria-pressed={layout === "list"} onClick={() => setLayout("list")} title="List view"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><span className="sr-only">List</span></button>
            </div>
          </div>
        </header>

        <div className="ds-chips" role="group" aria-label="Filter by product">
          <button aria-pressed={params.kind === ""} onClick={() => update({ kind: "" })}>All <small>{total}</small></button>
          {KINDS.map((k) => (
            <button key={k.key} aria-pressed={params.kind === k.key} onClick={() => update({ kind: k.key })}>
              <i style={{ background: k.color }} />{k.plural} <small>{data.counts[k.key] || 0}</small>
            </button>
          ))}
        </div>

        <div aria-live="polite" className="sr-only">{loading ? "Loading designs" : `${data.total} designs`}</div>
        <div className={loading ? "ds-results is-loading" : "ds-results"}>
          {data.items.length === 0 ? (
            <Empty section={params.section} q={params.q} kind={params.kind} onCreate={() => setCreating(params.kind || true)} onClear={() => { setSearch(""); update({ q: "", kind: "" }); }} />
          ) : layout === "grid" ? (
            <div className="ds-grid">{data.items.map((a) => <AssetCard key={`${a.kind}:${a.id}`} a={a} brand={brand} trashMode={trashMode} q={params.q} {...handlers} />)}</div>
          ) : (
            <AssetTable items={data.items} brand={brand} trashMode={trashMode} {...handlers} />
          )}
          {data.items.length < data.total && <div className="ds-more"><button className="ds-btn" disabled={loading} onClick={() => void load(params, page + 1)}>{loading ? "Loading…" : `Show more (${data.total - data.items.length} left)`}</button></div>}
        </div>
      </main>

      {creating && <NewDesign initial={creating === true ? null : creating} enabled={enabled} brand={brand} onClose={() => setCreating(null)} onDuplicate={(a) => { setCreating(null); void duplicate(a); }} />}
      {preview && <PreviewDialog asset={preview} brand={brand} onClose={() => setPreview(null)} onDownload={download} />}
      {confirm && (
        <Modal label={confirm.title} onClose={() => setConfirm(null)}>
          <div className="ds-confirm"><h2>{confirm.title}</h2><p>{confirm.body}</p>
            <div><button className="ds-btn" onClick={() => setConfirm(null)}>Cancel</button><button className="ds-btn ds-btn-danger" onClick={() => { confirm.run(); setConfirm(null); }}>{confirm.action}</button></div>
          </div>
        </Modal>
      )}
      <div className="ds-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`ds-toast ${t.tone === "error" ? "is-error" : ""}`}>
            <span>{t.text}</span>
            {t.action && <button onClick={() => { t.action!.run(); setToasts((x) => x.filter((y) => y.id !== t.id)); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ cards and rows

type Handlers = {
  onRename: (a: AssetItem, n: string) => void; onFavorite: (a: AssetItem) => void; onDuplicate: (a: AssetItem) => void; onTrash: (a: AssetItem) => void;
  onRestore: (a: AssetItem) => void; onUnpublish: (a: AssetItem) => void; onPreview: (a: AssetItem) => void; onDownload: (a: AssetItem, f: string, stage: HTMLElement | null) => void;
};

function highlight(text: string, q: string): ReactNode {
  const w = q.trim().split(/\s+/).filter(Boolean)[0];
  const i = w ? text.toLowerCase().indexOf(w.toLowerCase()) : -1;
  return i < 0 ? text : <>{text.slice(0, i)}<mark>{text.slice(i, i + w.length)}</mark>{text.slice(i + w.length)}</>;
}

function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className="ds-star" aria-pressed={on} onClick={onClick} title={on ? "Remove from favourites" : "Add to favourites"}>
      <svg viewBox="0 0 24 24" width="17" height="17" aria-hidden><path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z" fill={on ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
      <span className="sr-only">Favourite</span>
    </button>
  );
}

function useOutside(open: boolean, close: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const on = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) close(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("mousedown", on); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", on); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return ref;
}

function NameInput({ value, onSave, onDone, max }: { value: string; onSave: (v: string) => void; onDone: () => void; max: number }) {
  const [draft, setDraft] = useState(value);
  const finish = (save: boolean) => { if (save) onSave(draft); onDone(); };
  return <input className="ds-name-input" autoFocus value={draft} maxLength={max} aria-label="Design name" onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(true)}
    onKeyDown={(e: ReactKeyboardEvent) => { if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); }} />;
}

function ActionMenu({ a, trashMode, onRename, h, root }: { a: AssetItem; trashMode: boolean; onRename: () => void; h: Handlers; root: () => HTMLElement | null }) {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const ref = useOutside(open, close);
  const opts = downloadOptions(a);
  const pub = publicHref(a);
  const item = (label: string, run: () => void, danger = false) => <button role="menuitem" className={danger ? "ds-danger" : undefined} onClick={() => { close(); run(); }}>{label}</button>;
  return (
    <div className="ds-menu" ref={ref}>
      <button className="ds-icon-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={`Actions for ${a.name}`}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
      </button>
      {open && (
        <div className="ds-menu-pop" role="menu">
          {trashMode ? <>{item("Restore", () => h.onRestore(a))}{item("Preview", () => h.onPreview(a))}</> : <>
            <Link role="menuitem" href={assetEditHref(a)} onClick={close}>Open in editor</Link>
            {item("Preview", () => h.onPreview(a))}
            {item("Rename", onRename)}
            {item("Duplicate", () => h.onDuplicate(a))}
            {item(a.favorite ? "Remove from favourites" : "Add to favourites", () => h.onFavorite(a))}
            {pub && <a role="menuitem" href={pub} target="_blank" rel="noreferrer" onClick={close}>Open public page</a>}
            {pub && item("Unpublish…", () => h.onUnpublish(a))}
            <hr />
            {Array.isArray(opts) ? (a.kind === "card" ? item("Preview to download…", () => h.onPreview(a)) : opts.map((o) => <span key={o.key}>{item(o.key === "copy" ? "Copy signature" : `Download ${o.label}`, () => h.onDownload(a, o.key, root()))}</span>)) : <p className="ds-menu-note">{opts.blocked}</p>}
            <hr />
            {item("Move to Trash…", () => h.onTrash(a), true)}
          </>}
        </div>
      )}
    </div>
  );
}

function AssetCard({ a, brand, trashMode, q, ...h }: { a: AssetItem; brand: Brand; trashMode: boolean; q: string } & Handlers) {
  const [renaming, setRenaming] = useState(false);
  const root = useRef<HTMLElement>(null);
  const info = kindInfo(a.kind);
  const href = assetEditHref(a);
  return (
    <article className="ds-card" ref={root} data-kind={a.kind}>
      <div className="ds-thumb">
        {/* Previews contain their own links (email, website), so the art is inert and a separate control sits on top. */}
        <div className="ds-thumb-art" inert><AssetArt asset={a} brand={brand} /></div>
        {trashMode ? <button className="ds-thumb-hit" onClick={() => h.onPreview(a)} aria-label={`Preview ${a.name}`} />
          : <Link className="ds-thumb-hit" href={href} aria-label={`Edit ${a.name}`} />}
        <span className="ds-type"><KindIcon kind={a.kind} size={11} />{info.label}</span>
        {!trashMode && <Star on={a.favorite} onClick={() => h.onFavorite(a)} />}
        <div className="ds-hover">
          <button className="ds-btn ds-btn-small" onClick={() => h.onPreview(a)}>Preview</button>
          {!trashMode && <Link className="ds-btn ds-btn-small ds-btn-primary" href={href}>Edit</Link>}
        </div>
      </div>
      <div className="ds-card-body">
        <div className="ds-card-title">
          {renaming ? <NameInput value={a.name} max={a.kind === "stamp" ? 64 : 120} onSave={(n) => h.onRename(a, n)} onDone={() => setRenaming(false)} />
            : <button className="ds-name" onDoubleClick={() => !trashMode && setRenaming(true)} onClick={() => h.onPreview(a)} title={trashMode ? a.name : `${a.name} · double-click to rename`}>{highlight(a.name, q)}</button>}
          <ActionMenu a={a} trashMode={trashMode} onRename={() => setRenaming(true)} h={h} root={() => root.current} />
        </div>
        <div className="ds-card-meta">{chips(a).map((c) => <span key={c} className="ds-chip">{c}</span>)}</div>
        <p className="ds-when" suppressHydrationWarning title={`Created ${fullDate(a.createdAt)} · Edited ${fullDate(a.updatedAt)}`}>{trashMode && a.deletedAt ? `Deleted ${ago(a.deletedAt)}` : `Edited ${ago(a.updatedAt)}`}</p>
      </div>
    </article>
  );
}

function AssetTable({ items, brand, trashMode, ...h }: { items: AssetItem[]; brand: Brand; trashMode: boolean } & Handlers) {
  return (
    <div className="ds-table-wrap">
      <table className="ds-table">
        <thead><tr><th>Preview</th><th>Name</th><th>Type</th><th>Last edited</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {items.map((a) => (
            <tr key={`${a.kind}:${a.id}`} data-kind={a.kind}>
              <td><div className="ds-row-thumb"><div className="ds-thumb-art" inert><AssetArt asset={a} brand={brand} /></div><button className="ds-thumb-hit" onClick={() => h.onPreview(a)} aria-label={`Preview ${a.name}`} /></div></td>
              <td>{trashMode ? <button className="ds-name" onClick={() => h.onPreview(a)}>{a.name}</button> : <Link className="ds-name" href={assetEditHref(a)}>{a.name}</Link>}<div className="ds-card-meta">{chips(a).map((c) => <span key={c} className="ds-chip">{c}</span>)}</div></td>
              <td><span className="ds-type-inline"><KindIcon kind={a.kind} size={11} />{kindInfo(a.kind).label}</span></td>
              <td title={fullDate(a.updatedAt)} suppressHydrationWarning>{ago(a.updatedAt)}</td>
              <td suppressHydrationWarning>{new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</td>
              <td className="ds-row-actions">
                {trashMode ? <button className="ds-btn ds-btn-small" onClick={() => h.onRestore(a)}>Restore</button> : <>
                  <Star on={a.favorite} onClick={() => h.onFavorite(a)} />
                  <Link className="ds-btn ds-btn-small" href={assetEditHref(a)}>Edit</Link>
                  <button className="ds-btn ds-btn-small" onClick={() => h.onPreview(a)}>Preview</button>
                  <button className="ds-icon-btn" onClick={() => h.onTrash(a)} aria-label={`Move ${a.name} to Trash`} title="Move to Trash"><CloseIcon width="14" height="14" /></button>
                </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ section, q, kind, onCreate, onClear }: { section: AssetSection; q: string; kind: AssetKind | ""; onCreate: () => void; onClear: () => void }) {
  const label = kind ? kindInfo(kind).plural.toLowerCase() : "designs";
  return (
    <div className="ds-empty">
      <FolderIcon width="28" height="28" />
      {q ? <><h2>No {label} match “{q}”</h2><p>Try a person’s name, the text printed on a stamp, or a QR type such as “event”.</p><button className="ds-btn" onClick={onClear}>Clear search</button></>
        : section === "trash" ? <><h2>Trash is empty</h2><p>Designs you move to Trash stay here so you can restore them.</p></>
        : section === "favorites" ? <><h2>No favourites yet</h2><p>Star a design to keep it one click away.</p></>
        : section === "recent" ? <><h2>Nothing used recently</h2><p>Designs you open or edit in the next 14 days appear here.</p></>
        : <><h2>No {label} yet</h2><p>Make one now. It will appear here, ready to edit, rename, duplicate or download whenever you need it.</p><button className="ds-btn ds-btn-primary" onClick={onCreate}>Create {kind ? `a ${kindInfo(kind).label.toLowerCase()}` : "a design"}</button></>}
    </div>
  );
}

// ------------------------------------------------------------------ dialogs

function Modal({ label, onClose, children, wide }: { label: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", esc); document.body.style.overflow = ""; prev?.focus?.(); };
  }, [onClose]);
  return (
    <div className="ds-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`ds-modal ${wide ? "ds-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <button className="ds-icon-btn ds-modal-close" onClick={onClose} aria-label="Close"><CloseIcon width="18" height="18" /></button>
        {children}
      </div>
    </div>
  );
}

function NewDesign({ initial, enabled, brand, onClose, onDuplicate }: { initial: AssetKind | null; enabled: AssetKind[]; brand: Brand; onClose: () => void; onDuplicate: (a: AssetItem) => void }) {
  const [kind, setKind] = useState<AssetKind | null>(initial);
  const [mine, setMine] = useState<AssetItem[] | null>(null);
  useEffect(() => {
    if (!kind) return;
    let live = true;
    fetch(`/api/assets?kind=${kind}`, { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((b: AssetPage | null) => live && setMine(b?.items.slice(0, 4) ?? [])).catch(() => live && setMine([]));
    return () => { live = false; setMine(null); };
  }, [kind]);
  const info = kind ? kindInfo(kind) : null;
  return (
    <Modal label="New design" onClose={onClose} wide>
      {!kind || !info ? (
        <div className="ds-new-step">
          <h2>What do you want to make?</h2>
          <div className="ds-product-grid">
            {KINDS.filter((k) => enabled.includes(k.key)).map((k) => (
              <button key={k.key} onClick={() => setKind(k.key)}><KindIcon kind={k.key} size={20} /><span><b>{k.label}</b><small>{k.blurb}</small></span></button>
            ))}
          </div>
        </div>
      ) : (
        <div className="ds-new-step">
          <button className="ds-link" onClick={() => setKind(null)}>← All products</button>
          <h2>{info.label}</h2>
          <div className="ds-start-grid">
            <Link className="ds-start" href={info.create}>
              <KindIcon kind={kind} size={22} />
              <span><b>Start a new {info.label.toLowerCase()}</b><small>{kind === "stamp" ? "Choose from 23 stamp templates, then customise." : kind === "qr" ? "Pick what a scan should open, then style it." : kind === "print" ? "Combine a card, QR code and stamp you saved." : "Begin with a ready layout and your details."}</small></span>
            </Link>
          </div>
          <h3 className="ds-subhead">Or copy one of yours <span>Makes an editable copy; the original stays as it is.</span></h3>
          {mine === null ? <p className="ds-muted">Loading your designs…</p> : mine.length === 0 ? <p className="ds-muted">You have no saved {info.plural.toLowerCase()} yet.</p> : (
            <div className="ds-template-grid">
              {mine.map((a) => (
                <div key={a.id} className="ds-template">
                  <span className="ds-template-art" inert><AssetArt asset={a} brand={brand} /></span>
                  <b>{a.name}</b><small>Duplicate and edit</small>
                  <button className="ds-thumb-hit" onClick={() => onDuplicate(a)} aria-label={`Duplicate ${a.name} and edit the copy`} />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function PreviewDialog({ asset, brand, onClose, onDownload }: { asset: AssetItem; brand: Brand; onClose: () => void; onDownload: (a: AssetItem, f: string, stage: HTMLElement | null) => void }) {
  const [zoom, setZoom] = useState(1);
  const [surface, setSurface] = useState<"plain" | "transparent" | "document">(asset.kind === "stamp" ? "transparent" : "plain");
  const stage = useRef<HTMLDivElement>(null);
  const opts = downloadOptions(asset);
  const pub = publicHref(asset);
  const step = (d: number) => setZoom((z) => Math.min(2, Math.max(0.5, Math.round((z + d) * 100) / 100)));
  const art = <div className={`ds-big ds-big-${asset.kind}`}><AssetArt asset={asset} brand={brand} /></div>;
  return (
    <Modal label={`Preview ${asset.name}`} onClose={onClose} wide>
      <div className="ds-preview">
        <div>
          <div className="ds-stagebar">
            {asset.kind === "stamp" ? <div className="ds-seg" role="group" aria-label="Preview surface">
              <button aria-pressed={surface === "transparent"} onClick={() => setSurface("transparent")}>Transparent</button>
              <button aria-pressed={surface === "document"} onClick={() => setSurface("document")}>On a document</button>
            </div> : <span />}
            <div className="ds-zoom" role="group" aria-label="Zoom">
              <button onClick={() => step(-0.25)} aria-label="Zoom out" disabled={zoom <= 0.5}>−</button>
              <button onClick={() => setZoom(1)} title="Reset zoom">{Math.round(zoom * 100)}%</button>
              <button onClick={() => step(0.25)} aria-label="Zoom in" disabled={zoom >= 2}>+</button>
            </div>
          </div>
          <div className={`ds-stage ${surface === "transparent" ? "ds-checker" : ""}`} ref={stage}>
            <div className="ds-stage-inner" style={{ transform: `scale(${zoom})` }}>
              {surface === "document" ? (
                <div className="ds-doc"><div className="ds-doc-lines"><b>INVOICE APPROVAL</b><span /><span /><span className="short" /><span /><span className="short" /></div><div className="ds-doc-stamp">{art}</div><div className="ds-doc-sign">Authorised by ____________________</div></div>
              ) : art}
            </div>
          </div>
        </div>
        <aside className="ds-preview-side">
          <p className="ds-type-inline"><KindIcon kind={asset.kind} size={12} />{kindInfo(asset.kind).label}</p>
          <h2>{asset.name}</h2>
          <dl className="ds-dl">
            <dt>Status</dt><dd>{chips(asset).join(" · ")}</dd>
            <dt>Created</dt><dd>{fullDate(asset.createdAt)}</dd>
            <dt>Last edited</dt><dd>{fullDate(asset.updatedAt)}</dd>
            {asset.kind === "stamp" && <><dt>Printed text</dt><dd>{((asset.data.items as { text?: string }[]) || []).map((i) => i.text).filter(Boolean).join(" · ")}</dd></>}
          </dl>
          <div className="ds-stack">
            {!asset.deletedAt && <Link className="ds-btn ds-btn-primary" href={assetEditHref(asset)}>Edit design</Link>}
            {pub && <a className="ds-btn" href={pub} target="_blank" rel="noreferrer">Open public page</a>}
            {!asset.deletedAt && (Array.isArray(opts) ? opts.map((o) => (
              <button key={o.key} className="ds-btn ds-btn-download" onClick={() => onDownload(asset, o.key, stage.current)}>
                <span>{o.key === "copy" ? o.label : `Download ${o.label}`}</span>{o.note && <small>{o.note}</small>}
              </button>
            )) : <p className="ds-hint">{opts.blocked}</p>)}
            {asset.deletedAt && <p className="ds-hint">Restore this design to edit or download it.</p>}
          </div>
        </aside>
      </div>
    </Modal>
  );
}
