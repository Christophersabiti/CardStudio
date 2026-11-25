"use client";
/*
 * PROTOTYPE ONLY — unified "My designs" workspace for the redesign review.
 * Mock data lives in this browser's localStorage; no network writes happen.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { PlusIcon, CloseIcon, FolderIcon } from "@/components/icons";
import { BigArt, KindIcon, Zoom } from "./ui";
import { KINDS, TEMPLATES, assetChips, fullDate, kindInfo, newId, qrPayload, relativeTime, searchText, seedAssets, type Asset, type Kind, type TemplateDef } from "./data";
import { AssetArt, FORMATS, SURFACES, Surfaced, exportAsset, type Surface } from "./renderers";
import Editor from "./Editor";
import "./prototype.css";

/** Event-time clock (handlers only; keeps render pure). */
const clock = () => Date.now();
const STORE = "card-studio-prototype-assets-v1";
type Section = "all" | "favorites" | "recent" | "trash";
type Sort = "updated" | "created" | "name";
type Toast = { id: number; text: string; undo?: () => void; tone?: "error" };
type Confirm = { title: string; body: string; action: string; run: () => void };


function uniqueName(name: string, all: Asset[], skip?: string) {
  const taken = new Set(all.filter((a) => a.id !== skip && !a.deletedAt).map((a) => a.name.toLowerCase()));
  if (!taken.has(name.toLowerCase())) return name;
  for (let i = 2; ; i++) if (!taken.has(`${name} (${i})`.toLowerCase())) return `${name} (${i})`;
}

export default function Workspace() {
  const [assets, setAssets] = useState<Asset[] | null>(null);
  const [now, setNow] = useState(() => clock());
  const [editing, setEditing] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("all");
  const [kind, setKind] = useState<Kind | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("updated");
  const [layout, setLayout] = useState<"grid" | "list">("grid");
  const [creating, setCreating] = useState<Kind | true | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const search = useRef<HTMLInputElement>(null);

  // Restore browser-only prototype data after hydration (seed ids/dates must not run during SSR).
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let stored: Asset[] | null = null;
    try { stored = JSON.parse(localStorage.getItem(STORE) || "null"); } catch { stored = null; }
    setAssets(Array.isArray(stored) && stored.length ? stored : seedAssets());
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => { if (assets) try { localStorage.setItem(STORE, JSON.stringify(assets)); } catch { /* prototype keeps working in memory */ } }, [assets]);
  useEffect(() => { const t = setInterval(() => setNow(clock()), 60_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = (e.target as HTMLElement)?.closest("input,textarea,select,[contenteditable]");
      if (e.key === "/" && !typing && !editing) { e.preventDefault(); search.current?.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const toast = useCallback((text: string, opts: Omit<Toast, "id" | "text"> = {}) => {
    const id = clock() + Math.random();
    setToasts((t) => [...t.slice(-2), { id, text, ...opts }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), opts.undo ? 7000 : 3500);
  }, []);

  const all = useMemo(() => assets ?? [], [assets]);
  const live = all.filter((a) => !a.deletedAt);
  const put = useCallback((next: Asset) => setAssets((list) => (list ?? []).map((a) => (a.id === next.id ? next : a))), []);
  const patch = useCallback((id: string, p: Partial<Asset>) => setAssets((list) => (list ?? []).map((a) => (a.id === id ? ({ ...a, ...p } as Asset) : a))), []);

  function rename(id: string, name: string) {
    const clean = name.trim().slice(0, 120);
    if (!clean) return toast("A design needs a name.", { tone: "error" });
    const before = all.find((a) => a.id === id);
    if (!before || before.name === clean) return;
    patch(id, { name: uniqueName(clean, all, id), updatedAt: clock() });
    toast(`Renamed to “${clean}”`, { undo: () => patch(id, { name: before.name }) });
  }
  function duplicate(id: string, open = false) {
    const src = all.find((a) => a.id === id);
    if (!src) return;
    const t = clock();
    const copy = { ...structuredClone(src), id: newId(), name: uniqueName(`${src.name} copy`, all), favorite: false, createdAt: t, updatedAt: t, openedAt: t } as Asset;
    setAssets((list) => [copy, ...(list ?? [])]);
    toast(`Duplicated as “${copy.name}”`);
    if (open) setEditing(copy.id);
    return copy.id;
  }
  function trash(id: string) {
    const a = all.find((x) => x.id === id);
    if (!a) return;
    setConfirm({
      title: `Move “${a.name}” to Trash?`,
      body: "It stops appearing in your designs. Published links stop working until you restore it.",
      action: "Move to Trash",
      run: () => {
        patch(id, { deletedAt: clock() });
        if (editing === id) setEditing(null);
        toast(`“${a.name}” moved to Trash`, { undo: () => patch(id, { deletedAt: undefined }) });
      },
    });
  }
  function purge(id: string) {
    const a = all.find((x) => x.id === id);
    if (!a) return;
    setConfirm({ title: `Delete “${a.name}” permanently?`, body: "This cannot be undone.", action: "Delete permanently", run: () => { setAssets((l) => (l ?? []).filter((x) => x.id !== id)); toast("Deleted permanently"); } });
  }
  function open(id: string) { patch(id, { openedAt: clock() }); setEditing(id); }
  function create(t: TemplateDef, name: string) {
    const ts = clock();
    const data = structuredClone(t.make());
    if (t.kind === "print") {
      const pick = (k: Kind) => live.find((a) => a.kind === k)?.id || "";
      Object.assign(data, { cardId: pick("card"), qrId: pick("qr"), stampId: pick("stamp") });
    }
    const asset = { id: newId(), kind: t.kind, name: uniqueName(name.trim() || t.suggest, all), templateName: t.name, favorite: false, createdAt: ts, updatedAt: ts, openedAt: ts, data } as Asset;
    setAssets((l) => [asset, ...(l ?? [])]);
    setCreating(null);
    setEditing(asset.id);
    toast(`Created “${asset.name}” from the ${t.name} template`);
  }
  async function download(a: Asset, format: string, root: HTMLElement | null) {
    try { toast(await exportAsset(a, format, root, all)); patch(a.id, { openedAt: clock() }); }
    catch (e) { toast(e instanceof Error ? e.message : "Download failed", { tone: "error" }); }
  }

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const words = q.split(/\s+/).filter(Boolean);
    let list = all.filter((a) => (section === "trash" ? a.deletedAt : !a.deletedAt));
    if (section === "favorites") list = list.filter((a) => a.favorite);
    if (section === "recent") list = list.filter((a) => now - Math.max(a.openedAt, a.updatedAt) < 14 * 86_400_000);
    if (kind !== "all") list = list.filter((a) => a.kind === kind);
    if (words.length) list = list.filter((a) => { const hay = `${a.name} ${kindInfo(a.kind).label} ${kindInfo(a.kind).plural} ${a.templateName} ${searchText(a)}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
    const by = { updated: (a: Asset, b: Asset) => (section === "recent" ? Math.max(b.openedAt, b.updatedAt) - Math.max(a.openedAt, a.updatedAt) : b.updatedAt - a.updatedAt), created: (a: Asset, b: Asset) => b.createdAt - a.createdAt, name: (a: Asset, b: Asset) => a.name.localeCompare(b.name) }[sort];
    return [...list].sort(by);
  }, [all, section, kind, query, sort, now]);

  const counts = useMemo(() => {
    const base = all.filter((a) => (section === "trash" ? a.deletedAt : !a.deletedAt) && (section !== "favorites" || a.favorite));
    return Object.fromEntries([["all", base.length], ...KINDS.map((k) => [k.key, base.filter((a) => a.kind === k.key).length])]) as Record<Kind | "all", number>;
  }, [all, section]);

  if (!assets) return <div className="pt-loading">Loading your designs…</div>;

  const editingAsset = editing ? all.find((a) => a.id === editing && !a.deletedAt) : undefined;
  if (editingAsset)
    return (
      <>
        <Editor
          key={editingAsset.id}
          asset={editingAsset}
          all={all}
          onSave={(a) => { put({ ...a, name: uniqueName(a.name, all, a.id), updatedAt: clock() } as Asset); toast("Saved"); }}
          onBack={() => setEditing(null)}
          onDuplicate={() => duplicate(editingAsset.id, true)}
          onTrash={() => trash(editingAsset.id)}
          onDownload={download}
          onFavorite={() => patch(editingAsset.id, { favorite: !editingAsset.favorite })}
        />
        <Overlays confirm={confirm} setConfirm={setConfirm} toasts={toasts} />
      </>
    );

  const preview = previewId ? all.find((a) => a.id === previewId) : undefined;
  const recent = [...live].sort((a, b) => Math.max(b.openedAt, b.updatedAt) - Math.max(a.openedAt, a.updatedAt)).slice(0, 4);
  const sectionTitle = { all: "All designs", favorites: "Favourites", recent: "Recently used", trash: "Trash" }[section];

  return (
    <div className="pt-shell">
      <aside className="pt-side" aria-label="Design library">
        <button className="pt-btn pt-btn-primary pt-new" onClick={() => setCreating(true)}><PlusIcon width="16" height="16" /> New design</button>
        <nav className="pt-sidenav">
          {(["all", "favorites", "recent", "trash"] as Section[]).map((s) => (
            <button key={s} aria-current={section === s ? "page" : undefined} onClick={() => { setSection(s); setKind("all"); }}>
              <span>{{ all: "All designs", favorites: "Favourites", recent: "Recent", trash: "Trash" }[s]}</span>
              <small>{s === "all" ? live.length : s === "favorites" ? live.filter((a) => a.favorite).length : s === "trash" ? all.filter((a) => a.deletedAt).length : ""}</small>
            </button>
          ))}
        </nav>
        <p className="pt-side-label">Create</p>
        <nav className="pt-sidenav pt-sidenav-kinds">
          {KINDS.map((k) => <button key={k.key} onClick={() => setCreating(k.key)}><KindIcon kind={k.key} size={13} /><span>{k.label}</span></button>)}
        </nav>
        <div className="pt-proto-note">
          <b>Prototype</b>
          <p>Sample data, saved in this browser only. No account data is read or changed.</p>
          <button className="pt-link" onClick={() => setConfirm({ title: "Reset sample designs?", body: "Your prototype changes in this browser will be replaced with the original sample library.", action: "Reset", run: () => { setAssets(seedAssets()); toast("Sample library restored"); } })}>Reset sample data</button>
        </div>
      </aside>

      <main className="pt-main" id="main-content">
        <header className="pt-head">
          <div>
            <p className="pt-eyebrow">My designs</p>
            <h1>{sectionTitle}</h1>
          </div>
          <div className="pt-tools">
            <label className="pt-search">
              <span className="sr-only">Search designs</span>
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" /><path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              <input ref={search} type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names, people, stamp text…" />
              {!query && <kbd>/</kbd>}
            </label>
            <label className="pt-select"><span className="sr-only">Sort</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
                <option value="updated">Last edited</option><option value="created">Date created</option><option value="name">Name A–Z</option>
              </select>
            </label>
            <div className="pt-seg" role="group" aria-label="Layout">
              <button aria-pressed={layout === "grid"} onClick={() => setLayout("grid")} title="Grid view"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z" fill="currentColor" /></svg><span className="sr-only">Grid</span></button>
              <button aria-pressed={layout === "list"} onClick={() => setLayout("list")} title="List view"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden><path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg><span className="sr-only">List</span></button>
            </div>
          </div>
        </header>

        <div className="pt-chips" role="tablist" aria-label="Filter by product">
          <button role="tab" aria-selected={kind === "all"} onClick={() => setKind("all")}>All <small>{counts.all}</small></button>
          {KINDS.map((k) => (
            <button key={k.key} role="tab" aria-selected={kind === k.key} onClick={() => setKind(k.key)}>
              <i style={{ background: k.color }} />{k.plural} <small>{counts[k.key]}</small>
            </button>
          ))}
        </div>

        {section === "all" && kind === "all" && !query && recent.length > 0 && (
          <section className="pt-continue" aria-label="Continue editing">
            <h2>Continue where you left off</h2>
            <div>
              {recent.map((a) => (
                <button key={a.id} onClick={() => open(a.id)}>
                  <span className="pt-continue-art"><AssetArt asset={a} all={all} /></span>
                  <span><b>{a.name}</b><small>{kindInfo(a.kind).label} · {relativeTime(Math.max(a.openedAt, a.updatedAt), now)}</small></span>
                </button>
              ))}
            </div>
          </section>
        )}

        {visible.length === 0 ? (
          <Empty section={section} query={query} kind={kind} onCreate={() => setCreating(kind === "all" ? true : kind)} onClear={() => { setQuery(""); setKind("all"); }} />
        ) : layout === "grid" ? (
          <div className="pt-grid">
            {visible.map((a) => (
              <AssetCard key={a.id} a={a} all={all} now={now} trashMode={section === "trash"} query={query}
                onOpen={() => open(a.id)} onPreview={() => setPreviewId(a.id)} onRename={(n) => rename(a.id, n)}
                onDuplicate={() => duplicate(a.id)} onTrash={() => trash(a.id)} onFavorite={() => patch(a.id, { favorite: !a.favorite })}
                onRestore={() => { patch(a.id, { deletedAt: undefined }); toast(`Restored “${a.name}”`); }} onPurge={() => purge(a.id)} onDownload={download} />
            ))}
          </div>
        ) : (
          <AssetTable list={visible} all={all} now={now} trashMode={section === "trash"} onOpen={open} onPreview={setPreviewId} onDownload={download}
            onRestore={(id) => patch(id, { deletedAt: undefined })} onTrash={trash} onFavorite={(id) => { const x = all.find((y) => y.id === id); if (x) patch(id, { favorite: !x.favorite }); }} />
        )}
      </main>

      {creating && <NewDesign initial={creating === true ? null : creating} mine={live} onClose={() => setCreating(null)} onCreate={create} onDuplicateMine={(id) => { setCreating(null); duplicate(id, true); }} />}
      {preview && <PreviewDialog asset={preview} all={all} onClose={() => setPreviewId(null)} onEdit={() => { setPreviewId(null); open(preview.id); }} onDownload={download} />}
      <Overlays confirm={confirm} setConfirm={setConfirm} toasts={toasts} />
    </div>
  );
}

// ------------------------------------------------------------------ pieces

function highlight(text: string, query: string): ReactNode {
  const q = query.trim().split(/\s+/).filter(Boolean)[0];
  if (!q) return text;
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return text;
  return <>{text.slice(0, i)}<mark>{text.slice(i, i + q.length)}</mark>{text.slice(i + q.length)}</>;
}

function InlineName({ value, onSave, className, autoEdit = false, onDone }: { value: string; onSave: (v: string) => void; className?: string; autoEdit?: boolean; onDone?: () => void }) {
  const [draft, setDraft] = useState<string | null>(autoEdit ? value : null);
  const finish = (save: boolean) => { if (save && draft !== null) onSave(draft); setDraft(null); onDone?.(); };
  if (draft === null)
    return <button className={`pt-name ${className || ""}`} onDoubleClick={() => setDraft(value)} title="Double-click to rename">{value}</button>;
  return (
    <input className={`pt-name-input ${className || ""}`} autoFocus value={draft} maxLength={120} aria-label="Design name"
      onFocus={(e) => e.currentTarget.select()} onChange={(e) => setDraft(e.target.value)} onBlur={() => finish(true)}
      onKeyDown={(e: ReactKeyboardEvent) => { if (e.key === "Enter") finish(true); if (e.key === "Escape") finish(false); }} />
  );
}

function Star({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button className="pt-star" aria-pressed={on} onClick={onClick} title={on ? "Remove from favourites" : "Add to favourites"}>
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
    document.addEventListener("mousedown", on);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", on); document.removeEventListener("keydown", esc); };
  }, [open, close]);
  return ref;
}

type CardProps = {
  a: Asset; all: Asset[]; now: number; trashMode: boolean; query: string;
  onOpen: () => void; onPreview: () => void; onRename: (n: string) => void; onDuplicate: () => void; onTrash: () => void;
  onFavorite: () => void; onRestore: () => void; onPurge: () => void; onDownload: (a: Asset, f: string, root: HTMLElement | null) => void;
};
function AssetCard({ a, all, now, trashMode, query, onOpen, onPreview, onRename, onDuplicate, onTrash, onFavorite, onRestore, onPurge, onDownload }: CardProps) {
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const close = useCallback(() => setMenu(false), []);
  const menuRef = useOutside(menu, close);
  const root = useRef<HTMLElement>(null);
  const info = kindInfo(a.kind);
  return (
    <article className="pt-card" ref={root} data-kind={a.kind}>
      <div className="pt-thumb">
        <button className="pt-thumb-open" onClick={trashMode ? onPreview : onOpen} aria-label={`${trashMode ? "Preview" : "Edit"} ${a.name}`}>
          <AssetArt asset={a} all={all} />
        </button>
        <span className="pt-type" style={{ ["--k" as string]: info.color }}><KindIcon kind={a.kind} size={11} />{info.label}</span>
        {!trashMode && <Star on={a.favorite} onClick={onFavorite} />}
        <div className="pt-hover">
          <button className="pt-btn pt-btn-small" onClick={onPreview}>Preview</button>
          {!trashMode && <button className="pt-btn pt-btn-small pt-btn-primary" onClick={onOpen}>Edit</button>}
        </div>
      </div>
      <div className="pt-card-body">
        <div className="pt-card-title">
          {renaming ? <InlineName value={a.name} onSave={onRename} autoEdit onDone={() => setRenaming(false)} /> :
            <button className="pt-name" onDoubleClick={() => !trashMode && setRenaming(true)} onClick={trashMode ? onPreview : onOpen} title={trashMode ? a.name : "Click to edit · double-click to rename"}>{highlight(a.name, query)}</button>}
          <div className="pt-menu" ref={menuRef}>
            <button className="pt-icon-btn" aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu((m) => !m)} aria-label={`Actions for ${a.name}`}>
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden><circle cx="5" cy="12" r="1.8" fill="currentColor" /><circle cx="12" cy="12" r="1.8" fill="currentColor" /><circle cx="19" cy="12" r="1.8" fill="currentColor" /></svg>
            </button>
            {menu && (
              <div className="pt-menu-pop" role="menu">
                {trashMode ? (
                  <>
                    <button role="menuitem" onClick={() => { close(); onRestore(); }}>Restore</button>
                    <button role="menuitem" onClick={() => { close(); onPreview(); }}>Preview</button>
                    <hr />
                    <button role="menuitem" className="pt-danger" onClick={() => { close(); onPurge(); }}>Delete permanently…</button>
                  </>
                ) : (
                  <>
                    <button role="menuitem" onClick={() => { close(); onOpen(); }}>Open in editor</button>
                    <button role="menuitem" onClick={() => { close(); onPreview(); }}>Preview</button>
                    <button role="menuitem" onClick={() => { close(); setRenaming(true); }}>Rename</button>
                    <button role="menuitem" onClick={() => { close(); onDuplicate(); }}>Duplicate</button>
                    <button role="menuitem" onClick={() => { close(); onFavorite(); }}>{a.favorite ? "Remove from favourites" : "Add to favourites"}</button>
                    <hr />
                    {FORMATS[a.kind].map((f) => <button key={f.key} role="menuitem" onClick={() => { close(); onDownload(a, f.key, root.current); }}>{f.key === "copy" ? "Copy signature" : `Download ${f.label.split(" · ")[0]}`}</button>)}
                    <hr />
                    <button role="menuitem" className="pt-danger" onClick={() => { close(); onTrash(); }}>Move to Trash…</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
        <div className="pt-card-meta">
          {assetChips(a).map((c) => <span key={c} className="pt-chip">{c}</span>)}
        </div>
        <p className="pt-when" title={`Created ${fullDate(a.createdAt)} · Edited ${fullDate(a.updatedAt)}`}>{trashMode && a.deletedAt ? `Deleted ${relativeTime(a.deletedAt, now)}` : `Edited ${relativeTime(a.updatedAt, now)}`}</p>
      </div>
    </article>
  );
}

function AssetTable({ list, all, now, trashMode, onOpen, onPreview, onDownload, onRestore, onTrash, onFavorite }: {
  list: Asset[]; all: Asset[]; now: number; trashMode: boolean; onOpen: (id: string) => void; onPreview: (id: string) => void;
  onDownload: (a: Asset, f: string, root: HTMLElement | null) => void; onRestore: (id: string) => void; onTrash: (id: string) => void; onFavorite: (id: string) => void;
}) {
  return (
    <div className="pt-table-wrap">
      <table className="pt-table">
        <thead><tr><th>Preview</th><th>Name</th><th>Type</th><th>Last edited</th><th>Created</th><th><span className="sr-only">Actions</span></th></tr></thead>
        <tbody>
          {list.map((a) => (
            <tr key={a.id} data-kind={a.kind}>
              <td><button className="pt-row-thumb" onClick={() => onPreview(a.id)} aria-label={`Preview ${a.name}`}><AssetArt asset={a} all={all} /></button></td>
              <td><button className="pt-name" onClick={() => (trashMode ? onPreview(a.id) : onOpen(a.id))}>{a.name}</button><div className="pt-card-meta">{assetChips(a).map((c) => <span key={c} className="pt-chip">{c}</span>)}</div></td>
              <td><span className="pt-type-inline"><KindIcon kind={a.kind} size={11} />{kindInfo(a.kind).label}</span></td>
              <td title={fullDate(a.updatedAt)}>{relativeTime(a.updatedAt, now)}</td>
              <td>{new Date(a.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</td>
              <td className="pt-row-actions">
                {trashMode ? <button className="pt-btn pt-btn-small" onClick={() => onRestore(a.id)}>Restore</button> : <>
                  <Star on={a.favorite} onClick={() => onFavorite(a.id)} />
                  <button className="pt-btn pt-btn-small" onClick={() => onOpen(a.id)}>Edit</button>
                  <button className="pt-btn pt-btn-small" onClick={() => onPreview(a.id)}>Preview</button>
                  <button className="pt-btn pt-btn-small" onClick={(e) => onDownload(a, FORMATS[a.kind][0].key, (e.currentTarget.closest("tr") as HTMLElement))}>{a.kind === "signature" ? "Copy" : "Download"}</button>
                  <button className="pt-icon-btn" onClick={() => onTrash(a.id)} aria-label={`Move ${a.name} to Trash`} title="Move to Trash"><CloseIcon width="14" height="14" /></button>
                </>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Empty({ section, query, kind, onCreate, onClear }: { section: Section; query: string; kind: Kind | "all"; onCreate: () => void; onClear: () => void }) {
  const label = kind === "all" ? "designs" : kindInfo(kind).plural.toLowerCase();
  return (
    <div className="pt-empty">
      <FolderIcon width="28" height="28" />
      {query ? <><h2>No {label} match “{query}”</h2><p>Try a person’s name, the text printed on a stamp, or a QR purpose like “WhatsApp”.</p><button className="pt-btn" onClick={onClear}>Clear search</button></>
        : section === "trash" ? <><h2>Trash is empty</h2><p>Designs you delete stay here so you can restore them.</p></>
        : section === "favorites" ? <><h2>No favourites yet</h2><p>Star a design to keep it one click away.</p></>
        : <><h2>No {label} yet</h2><p>Start from a template — you can rename and change everything later.</p><button className="pt-btn pt-btn-primary" onClick={onCreate}>Create {kind === "all" ? "a design" : `a ${kindInfo(kind).label.toLowerCase()}`}</button></>}
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
    <div className="pt-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`pt-modal ${wide ? "pt-modal-wide" : ""}`} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} ref={ref}>
        <button className="pt-icon-btn pt-modal-close" onClick={onClose} aria-label="Close"><CloseIcon width="18" height="18" /></button>
        {children}
      </div>
    </div>
  );
}

function NewDesign({ initial, mine, onClose, onCreate, onDuplicateMine }: { initial: Kind | null; mine: Asset[]; onClose: () => void; onCreate: (t: TemplateDef, name: string) => void; onDuplicateMine: (id: string) => void }) {
  const [kind, setKind] = useState<Kind | null>(initial);
  const [picked, setPicked] = useState<TemplateDef | null>(null);
  const [name, setName] = useState("");
  const list = TEMPLATES.filter((t) => t.kind === kind);
  const yours = mine.filter((a) => a.kind === kind).slice(0, 4);
  const pick = (t: TemplateDef) => { setPicked(t); setName(t.suggest); };
  return (
    <Modal label="New design" onClose={onClose} wide>
      {!kind ? (
        <div className="pt-new-step">
          <p className="pt-eyebrow">Step 1 of 3</p>
          <h2>What do you want to make?</h2>
          <div className="pt-product-grid">
            {KINDS.map((k) => (
              <button key={k.key} onClick={() => setKind(k.key)}>
                <KindIcon kind={k.key} size={20} />
                <span><b>{k.label}</b><small>{k.blurb}</small></span>
                <em>{mine.filter((a) => a.kind === k.key).length} saved</em>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="pt-new-step">
          <button className="pt-link" onClick={() => { setKind(null); setPicked(null); }}>← All products</button>
          <p className="pt-eyebrow">Step 2 of 3 · {kindInfo(kind).label}</p>
          <h2>Choose a starting point</h2>
          <h3 className="pt-subhead">Templates <span>Provided by Card Studio. Your copy is saved separately.</span></h3>
          <div className="pt-template-grid">
            {list.map((t) => {
              const fake = { id: `tpl-${t.key}`, kind: t.kind, name: t.name, templateName: t.name, favorite: false, createdAt: 0, updatedAt: 0, openedAt: 0, data: t.make() } as Asset;
              const pmFake = t.kind === "print" ? { ...fake, data: { ...(fake.data as object), cardId: mine.find((a) => a.kind === "card")?.id || "", qrId: mine.find((a) => a.kind === "qr")?.id || "", stampId: mine.find((a) => a.kind === "stamp")?.id || "" } } as Asset : fake;
              return (
                <button key={t.key} className="pt-template" aria-pressed={picked?.key === t.key} onClick={() => pick(t)}>
                  <span className="pt-template-art"><AssetArt asset={pmFake} all={mine} /></span>
                  <span className="pt-template-badge">Template</span>
                  <b>{t.name}</b><small>{t.note}</small>
                </button>
              );
            })}
          </div>
          {yours.length > 0 && (
            <>
              <h3 className="pt-subhead">Or reuse one of your designs <span>Creates a copy you can change.</span></h3>
              <div className="pt-template-grid pt-template-grid-mine">
                {yours.map((a) => (
                  <button key={a.id} className="pt-template" onClick={() => onDuplicateMine(a.id)}>
                    <span className="pt-template-art"><AssetArt asset={a} all={mine} /></span>
                    <span className="pt-template-badge pt-badge-mine">My design</span>
                    <b>{a.name}</b><small>Duplicate and edit</small>
                  </button>
                ))}
              </div>
            </>
          )}
          <form className={`pt-name-step ${picked ? "is-ready" : ""}`} onSubmit={(e) => { e.preventDefault(); if (picked) onCreate(picked, name); }}>
            <label>
              <span><b>Step 3 · Name this design</b> <small>Only you see this name. It is not printed on the {kindInfo(kind).label.toLowerCase()}.</small></span>
              <input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} disabled={!picked} placeholder={picked ? "" : "Choose a template first"} />
            </label>
            <button className="pt-btn pt-btn-primary" disabled={!picked || !name.trim()}>Create and customise</button>
          </form>
        </div>
      )}
    </Modal>
  );
}

function PreviewDialog({ asset, all, onClose, onEdit, onDownload }: { asset: Asset; all: Asset[]; onClose: () => void; onEdit: () => void; onDownload: (a: Asset, f: string, root: HTMLElement | null) => void }) {
  const surfaces = SURFACES[asset.kind];
  const [surface, setSurface] = useState<Surface>(surfaces[0].key);
  const [zoom, setZoom] = useState(1);
  const stage = useRef<HTMLDivElement>(null);
  return (
    <Modal label={`Preview ${asset.name}`} onClose={onClose} wide>
      <div className="pt-preview">
        <div className="pt-preview-stage-wrap">
          <div className="pt-stagebar">
            <div className="pt-seg" role="group" aria-label="Preview surface">
              {surfaces.map((s) => <button key={s.key} aria-pressed={surface === s.key} onClick={() => setSurface(s.key)}>{s.label}</button>)}
            </div>
            <Zoom zoom={zoom} setZoom={setZoom} />
          </div>
          <div className={`pt-stage ${surface === "transparent" ? "pt-checker" : ""}`} ref={stage}>
            <div className="pt-stage-inner" style={{ transform: `scale(${zoom})` }} data-kind={asset.kind}>
              <Surfaced surface={surface} kind={asset.kind} name={asset.name}><BigArt asset={asset} all={all} /></Surfaced>
            </div>
          </div>
        </div>
        <aside className="pt-preview-side">
          <p className="pt-type-inline"><KindIcon kind={asset.kind} size={12} />{kindInfo(asset.kind).label}</p>
          <h2>{asset.name}</h2>
          <dl className="pt-dl">
            <dt>Template</dt><dd>{asset.templateName}</dd>
            <dt>Created</dt><dd>{fullDate(asset.createdAt)}</dd>
            <dt>Last edited</dt><dd>{fullDate(asset.updatedAt)}</dd>
            {asset.kind === "qr" && <><dt>A scan opens</dt><dd className="pt-mono">{qrPayload(asset.data).replace(/\r\n/g, " · ")}</dd></>}
            {asset.kind === "stamp" && <><dt>Printed text</dt><dd>{asset.data.items.map((i) => i.text).filter(Boolean).join(" · ")}</dd></>}
          </dl>
          <div className="pt-stack">
            {!asset.deletedAt && <button className="pt-btn pt-btn-primary" onClick={onEdit}>Edit design</button>}
            {FORMATS[asset.kind].map((f) => <button key={f.key} className="pt-btn" onClick={() => onDownload(asset, f.key, stage.current)}>{f.key === "copy" ? "Copy signature" : `Download ${f.label}`}</button>)}
          </div>
        </aside>
      </div>
    </Modal>
  );
}


function Overlays({ confirm, setConfirm, toasts }: { confirm: Confirm | null; setConfirm: (c: Confirm | null) => void; toasts: Toast[] }) {
  return (
    <>
      {confirm && (
        <Modal label={confirm.title} onClose={() => setConfirm(null)}>
          <div className="pt-confirm">
            <h2>{confirm.title}</h2>
            <p>{confirm.body}</p>
            <div><button className="pt-btn" onClick={() => setConfirm(null)}>Cancel</button><button className="pt-btn pt-btn-danger" onClick={() => { confirm.run(); setConfirm(null); }}>{confirm.action}</button></div>
          </div>
        </Modal>
      )}
      <div className="pt-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`pt-toast ${t.tone === "error" ? "is-error" : ""}`}>
            <span>{t.text}</span>
            {t.undo && <button onClick={t.undo}>Undo</button>}
          </div>
        ))}
      </div>
    </>
  );
}
