"use client";
/* PROTOTYPE ONLY — small shared pieces for the workspace and editor. */
import { CardIcon, MailIcon, PrinterIcon, QrIcon, StampIcon, UsersIcon } from "@/components/icons";
import { kindInfo, type Asset, type Kind } from "./data";
import { AssetArt } from "./renderers";

const ICONS = { card: CardIcon, qr: QrIcon, group: UsersIcon, signature: MailIcon, stamp: StampIcon, print: PrinterIcon };

export function KindIcon({ kind, size = 16 }: { kind: Kind; size?: number }) {
  const Icon = ICONS[kind];
  return <span className="pt-kicon" style={{ background: kindInfo(kind).color }} aria-hidden><Icon width={size} height={size} /></span>;
}

export function BigArt({ asset, all }: { asset: Asset; all: Asset[] }) {
  // Same renderers as the thumbnails, without the thumbnail scaling wrappers.
  return <div className={`pt-big pt-big-${asset.kind}`}><AssetArt asset={asset} all={all} /></div>;
}

export function Zoom({ zoom, setZoom }: { zoom: number; setZoom: (z: number) => void }) {
  const step = (d: number) => setZoom(Math.min(2, Math.max(0.5, Math.round((zoom + d) * 100) / 100)));
  return (
    <div className="pt-zoom" role="group" aria-label="Zoom">
      <button onClick={() => step(-0.25)} aria-label="Zoom out" disabled={zoom <= 0.5}>−</button>
      <button onClick={() => setZoom(1)} title="Reset zoom">{Math.round(zoom * 100)}%</button>
      <button onClick={() => step(0.25)} aria-label="Zoom in" disabled={zoom >= 2}>+</button>
    </div>
  );
}
