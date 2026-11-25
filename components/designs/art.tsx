"use client";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import QRCode from "qrcode";
import CardPreview from "@/components/CardPreview";
import { StampSvg, type Design as StampDesign } from "@/components/marketing/StampMaker";
import "@/components/marketing/stamp-maker.css";
import type { Brand } from "@/lib/brand";
import { emptySignature, signatureHtml, type SignatureData } from "@/lib/email-signature";
import { qrDataUrl } from "@/lib/qr";
import { buildVcard } from "@/lib/vcard";
import { emptyCard, type CardData, type GroupData } from "@/lib/types";
import type { AssetItem, PrintConfig } from "@/lib/assets-schema";

export const origin = () => (typeof window === "undefined" ? "" : window.location.origin);
const noop = () => () => {};
/** The page origin, empty during server render so hydration matches. */
export const useOrigin = () => useSyncExternalStore(noop, () => window.location.origin, () => "");
export function publicHref(a: Pick<AssetItem, "kind" | "slug" | "published">): string | null {
  if (!a.published || !a.slug) return null;
  return a.kind === "card" ? `/c/${a.slug}` : a.kind === "group" ? `/g/${a.slug}` : a.kind === "qr" ? `/q/${a.slug}` : null;
}

/**
 * The card QR follows the editor's rule: a profile QR only when the published
 * snapshot matches the saved draft; an offline vCard QR always matches the draft.
 */
export function cardQrPayload(a: AssetItem, site: string): { payload: string; label: string } {
  const data = { ...emptyCard(), ...(a.data as Partial<CardData>) } as CardData;
  const dynamic = (data.qrMode || "dynamic") === "dynamic";
  if (!dynamic) return { payload: buildVcard(data), label: "Scan to save my contact" };
  return a.upToDate && a.slug ? { payload: site ? `${site}/c/${a.slug}` : "", label: "Scan to view my profile" } : { payload: "", label: "Publish to enable the profile QR" };
}

function useDataUrl(payload: string) {
  const [state, setState] = useState({ payload: "", url: "" });
  useEffect(() => {
    if (!payload) return;
    let live = true;
    qrDataUrl(payload, { width: 320 }).then((url) => live && setState({ payload, url })).catch(() => live && setState({ payload, url: "" }));
    return () => { live = false; };
  }, [payload]);
  return state.payload === payload ? state.url : "";
}

export function CardArt({ asset, brand }: { asset: AssetItem; brand: Brand }) {
  const { payload, label } = cardQrPayload(asset, useOrigin());
  const url = useDataUrl(payload);
  const data = { ...emptyCard(), ...(asset.data as Partial<CardData>) } as CardData;
  return <CardPreview data={data} qrUrl={url} brand={brand} qrLabel={label} appearance="light" />;
}

export function QrArt({ asset }: { asset: AssetItem }) {
  const d = asset.data as { color?: string; logo?: string; caption?: string };
  const [svg, setSvg] = useState("");
  const site = useOrigin();
  const url = site ? `${site}/q/${asset.slug}` : "";
  const color = /^#[0-9a-f]{6}$/i.test(d.color || "") ? d.color! : "#202520";
  useEffect(() => {
    if (!url) return;
    let live = true;
    QRCode.toString(url, { type: "svg", errorCorrectionLevel: "H", margin: 2, color: { dark: color, light: "#ffffff" } }).then((s) => live && setSvg(s)).catch(() => live && setSvg(""));
    return () => { live = false; };
  }, [url, color]);
  const logo = typeof d.logo === "string" && /^\/api\/qr-assets\/[0-9a-f-]{36}$/.test(d.logo) ? d.logo : "";
  return (
    <div className="ds-qr">
      <div className="ds-qr-code">
        {/* SVG produced locally by the qrcode library from this design's own link. */}
        <div className="ds-qr-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        {logo && <img className="ds-qr-logo" src={logo} alt="" />}
      </div>
      {d.caption && <p style={{ color }}>{d.caption}</p>}
    </div>
  );
}

export function StampArt({ design }: { design: StampDesign }) {
  return <div className="ds-stamp"><StampSvg design={design} /></div>;
}

export function SignatureArt({ data }: { data: SignatureData }) {
  // signatureHtml escapes every value and allowlists colours, fonts and URL protocols.
  const site = useOrigin();
  return <div className="ds-sig" dangerouslySetInnerHTML={{ __html: signatureHtml({ ...emptySignature, ...data }, site) }} />;
}

export function TeamArt({ data }: { data: GroupData }) {
  const members = Array.isArray(data.members) ? data.members : [];
  return (
    <div className="ds-team">
      <header><strong>{data.name || "Team"}</strong><span>{data.organization}</span></header>
      <ul>
        {members.slice(0, 5).map((m, i) => (
          <li key={i}><span className="ds-avatar">{(m.firstName?.[0] || "") + (m.lastName?.[0] || "")}</span><span><b>{m.firstName} {m.lastName}</b><small>{m.title}</small></span></li>
        ))}
        {members.length === 0 && <li className="ds-muted">No members yet</li>}
        {members.length > 5 && <li className="ds-muted">+{members.length - 5} more</li>}
      </ul>
    </div>
  );
}

export function PrintArt({ config }: { config: PrintConfig }) {
  const parts = [config.parts.card && config.cardId && "Business card", config.parts.qr && config.qrId && "QR code", config.parts.stamp && config.stampId && "Stamp"].filter(Boolean) as string[];
  return (
    <div className="ds-print-mini">
      <span className="ds-print-paper">{parts.map((p) => <i key={p}>{p}</i>)}</span>
      <small>{config.preset === "bleed" ? "With bleed" : "Exact size"}</small>
    </div>
  );
}

/** What each product's real renderer draws for this design. */
export function AssetArt({ asset, brand }: { asset: AssetItem; brand: Brand }): ReactNode {
  switch (asset.kind) {
    case "card": return <div className="ds-scale-card"><CardArt asset={asset} brand={brand} /></div>;
    case "group": return <TeamArt data={asset.data as unknown as GroupData} />;
    case "qr": return <QrArt asset={asset} />;
    case "stamp": return <StampArt design={asset.data as unknown as StampDesign} />;
    case "signature": return <div className="ds-scale-sig"><SignatureArt data={asset.data as unknown as SignatureData} /></div>;
    case "print": return <PrintArt config={asset.data as unknown as PrintConfig} />;
  }
}
