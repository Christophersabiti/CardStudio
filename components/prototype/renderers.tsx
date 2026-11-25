"use client";
/* PROTOTYPE ONLY — renders every asset kind with the product's real renderer, plus client-side exports. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState, type ReactNode } from "react";
import QRCode from "qrcode";
import { toPng } from "html-to-image";
import { zipSync, strToU8 } from "fflate";
import CardPreview from "@/components/CardPreview";
import { StampSvg } from "@/components/marketing/StampMaker";
import "@/components/marketing/stamp-maker.css";
import { activeBrand } from "@/lib/brand";
import { signatureHtml, type SignatureData } from "@/lib/email-signature";
import { buildVcard, buildGroupVcard } from "@/lib/vcard";
import { downloadBlob, dataUrlToBlob } from "@/lib/download";
import type { CardData, GroupData } from "@/lib/types";
import { qrPayload, type Asset, type QrData } from "./data";

// ------------------------------------------------------------------ QR

export function useQrSvg(q: QrData) {
  const [svg, setSvg] = useState("");
  const payload = qrPayload(q);
  useEffect(() => {
    let live = true;
    QRCode.toString(payload, { type: "svg", errorCorrectionLevel: q.logo ? "H" : "M", margin: 4, color: { dark: q.color, light: "#ffffff" } })
      .then((s) => live && setSvg(s))
      .catch(() => live && setSvg(""));
    return () => { live = false; };
  }, [payload, q.color, q.logo]);
  return svg;
}

export function QrArt({ q, showCaption = true }: { q: QrData; showCaption?: boolean }) {
  const svg = useQrSvg(q);
  return (
    <div className="pt-qr">
      <div className="pt-qr-code">
        {/* SVG markup produced locally by the qrcode library from the asset's own data. */}
        <div className="pt-qr-svg" dangerouslySetInnerHTML={{ __html: svg }} />
        {q.logo && <img className="pt-qr-logo" src="/brand/icon-192.png" alt="" />}
      </div>
      {showCaption && q.caption && <p style={{ color: q.color }}>{q.caption}</p>}
    </div>
  );
}

function useCardQr(data: CardData) {
  const [url, setUrl] = useState("");
  const vcard = buildVcard(data);
  useEffect(() => {
    let live = true;
    QRCode.toDataURL(vcard, { errorCorrectionLevel: "M", margin: 4, width: 256 }).then((u) => live && setUrl(u)).catch(() => live && setUrl(""));
    return () => { live = false; };
  }, [vcard]);
  return url;
}

export function CardArt({ data }: { data: CardData }) {
  const qr = useCardQr(data);
  return <CardPreview data={data} qrUrl={qr} brand={activeBrand} qrLabel="Scan to save my contact (offline vCard)" appearance="light" />;
}

export function SignatureArt({ data }: { data: SignatureData }) {
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  // signatureHtml escapes every user value and allowlists colours, fonts and URL protocols.
  return <div className="pt-sig" dangerouslySetInnerHTML={{ __html: signatureHtml(data, origin) }} />;
}

export function TeamArt({ data, color = "#d9822b" }: { data: GroupData; color?: string }) {
  return (
    <div className="pt-team">
      <header style={{ background: color }}>
        <strong>{data.name || "Team"}</strong>
        <span>{data.organization}</span>
      </header>
      <ul>
        {data.members.slice(0, 6).map((m, i) => (
          <li key={i}>
            <span className="pt-avatar">{(m.firstName[0] || "") + (m.lastName[0] || "")}</span>
            <span><b>{m.firstName} {m.lastName}</b><small>{m.title}</small></span>
          </li>
        ))}
        {data.members.length === 0 && <li className="pt-muted">No members yet</li>}
        {data.members.length > 6 && <li className="pt-muted">+{data.members.length - 6} more</li>}
      </ul>
    </div>
  );
}

export function StampArt({ asset }: { asset: Extract<Asset, { kind: "stamp" }> }) {
  return <div className="pt-stamp"><StampSvg design={asset.data} /></div>;
}

export function PrintArt({ asset, all }: { asset: Extract<Asset, { kind: "print" }>; all: Asset[] }) {
  const cardA = all.find((a) => a.id === asset.data.cardId && a.kind === "card") as Extract<Asset, { kind: "card" }> | undefined;
  const qrA = all.find((a) => a.id === asset.data.qrId && a.kind === "qr") as Extract<Asset, { kind: "qr" }> | undefined;
  const stampA = all.find((a) => a.id === asset.data.stampId && a.kind === "stamp") as Extract<Asset, { kind: "stamp" }> | undefined;
  return (
    <div className="pt-sheet" data-paper={asset.data.paper}>
      <div className="pt-sheet-head"><span>{asset.data.paper} · 300 dpi · 3 mm bleed</span></div>
      <div className="pt-sheet-grid">
        {asset.data.parts.card && <figure data-part="card"><div className="pt-scale pt-scale-card">{cardA ? <CardArt data={cardA.data} /> : <Missing label="Choose a card" />}</div><figcaption>Business card · 85 × 55 mm</figcaption></figure>}
        {asset.data.parts.qr && <figure data-part="qr">{qrA ? <QrArt q={qrA.data} /> : <Missing label="Choose a QR code" />}<figcaption>QR sheet · 60 × 60 mm</figcaption></figure>}
        {asset.data.parts.stamp && <figure data-part="stamp">{stampA ? <StampArt asset={stampA} /> : <Missing label="Choose a stamp" />}<figcaption>Stamp · 40 mm, transparent</figcaption></figure>}
      </div>
    </div>
  );
}
const Missing = ({ label }: { label: string }) => <div className="pt-missing">{label}</div>;

/** Whatever the product's real renderer draws for this asset. */
export function AssetArt({ asset, all }: { asset: Asset; all: Asset[] }): ReactNode {
  switch (asset.kind) {
    case "stamp": return <StampArt asset={asset} />;
    case "card": return <div className="pt-scale pt-scale-card"><CardArt data={asset.data} /></div>;
    case "qr": return <QrArt q={asset.data} />;
    case "signature": return <div className="pt-scale pt-scale-sig"><SignatureArt data={asset.data} /></div>;
    case "group": return <TeamArt data={asset.data} />;
    case "print": return <div className="pt-scale pt-scale-sheet"><PrintArt asset={asset} all={all} /></div>;
  }
}

// ------------------------------------------------------------------ surfaces

export type Surface = "plain" | "transparent" | "document" | "email" | "phone" | "poster";
export const SURFACES: Record<Asset["kind"], { key: Surface; label: string }[]> = {
  stamp: [{ key: "transparent", label: "Transparent" }, { key: "document", label: "On a document" }],
  card: [{ key: "plain", label: "Card" }, { key: "phone", label: "On a phone" }],
  qr: [{ key: "plain", label: "Code" }, { key: "poster", label: "On a table card" }],
  signature: [{ key: "email", label: "In an email" }, { key: "plain", label: "Signature only" }],
  group: [{ key: "phone", label: "On a phone" }, { key: "plain", label: "Directory" }],
  print: [{ key: "plain", label: "Sheet" }],
};

export function Surfaced({ surface, kind, name, children }: { surface: Surface; kind: Asset["kind"]; name: string; children: ReactNode }) {
  if (surface === "document" && kind === "stamp")
    return (
      <div className="pt-doc">
        <div className="pt-doc-lines"><b>INVOICE APPROVAL</b><span /><span /><span className="short" /><span /><span className="short" /></div>
        <div className="pt-doc-stamp">{children}</div>
        <div className="pt-doc-sign">Authorised by ____________________</div>
      </div>
    );
  if (surface === "email")
    return (
      <div className="pt-mail">
        <div className="pt-mail-bar"><span /><span /><span /></div>
        <div className="pt-mail-head"><b>To:</b> client@example.com<br /><b>Subject:</b> Proposal for the training programme</div>
        <div className="pt-mail-body"><p>Good morning,</p><p>Please find the proposal attached. I look forward to your feedback.</p><p>Kind regards,</p>{children}</div>
      </div>
    );
  if (surface === "phone") return <div className="pt-phone"><div className="pt-phone-notch" />{children}</div>;
  if (surface === "poster") return <div className="pt-poster"><b>Welcome</b><span>{name}</span>{children}</div>;
  return <>{children}</>;
}

// ------------------------------------------------------------------ exports (real, client-side)

export type Format = { key: string; label: string };
export const FORMATS: Record<Asset["kind"], Format[]> = {
  stamp: [{ key: "png", label: "PNG · transparent · 1500 px" }, { key: "svg", label: "SVG · vector" }],
  card: [{ key: "png", label: "PNG · 2× image" }, { key: "vcf", label: "vCard (.vcf)" }],
  qr: [{ key: "png", label: "PNG · 1024 px" }, { key: "svg", label: "SVG · vector" }],
  signature: [{ key: "copy", label: "Copy for Gmail / Outlook" }, { key: "html", label: "HTML file" }],
  group: [{ key: "vcf", label: "All contacts (.vcf)" }],
  print: [{ key: "zip", label: "ZIP · all parts" }],
};

const safeName = (s: string) => s.replace(/[^\p{L}\p{N}._ -]+/gu, "").trim().replace(/\s+/g, "-").slice(0, 80) || "design";

async function svgElementToPng(svg: SVGSVGElement, size = 1500): Promise<Blob> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(size));
  clone.setAttribute("height", String(size));
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    await new Promise<void>((ok, fail) => { img.onload = () => ok(); img.onerror = () => fail(new Error("Could not render the image")); img.src = url; });
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(img, 0, 0, size, size);
    return await new Promise<Blob>((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("PNG export failed"))), "image/png"));
  } finally { URL.revokeObjectURL(url); }
}

async function qrPng(q: QrData, size = 1024): Promise<Blob> {
  const canvas = document.createElement("canvas");
  await QRCode.toCanvas(canvas, qrPayload(q), { errorCorrectionLevel: q.logo ? "H" : "M", margin: 4, width: size, color: { dark: q.color, light: "#ffffff" } });
  if (q.logo) {
    const img = new Image();
    img.src = "/brand/icon-192.png";
    await img.decode();
    const s = size * 0.2, ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect((size - s) / 2 - 8, (size - s) / 2 - 8, s + 16, s + 16);
    ctx.drawImage(img, (size - s) / 2, (size - s) / 2, s, s);
  }
  return new Promise((ok, fail) => canvas.toBlob((b) => (b ? ok(b) : fail(new Error("PNG export failed"))), "image/png"));
}

/**
 * `root` is the element that holds the rendered preview for this asset (needed for card/stamp
 * captures, which reuse exactly what is on screen).
 */
export async function exportAsset(asset: Asset, format: string, root: HTMLElement | null, all: Asset[]): Promise<string> {
  const base = safeName(asset.name);
  if (asset.kind === "stamp") {
    const svg = root?.querySelector<SVGSVGElement>(".pt-stamp svg");
    if (!svg) throw new Error("Open the preview first.");
    if (format === "svg") { const c = svg.cloneNode(true) as SVGSVGElement; c.setAttribute("xmlns", "http://www.w3.org/2000/svg"); downloadBlob(`${base}.svg`, new Blob([new XMLSerializer().serializeToString(c)], { type: "image/svg+xml" })); return "SVG downloaded"; }
    downloadBlob(`${base}.png`, await svgElementToPng(svg)); return "Transparent PNG downloaded";
  }
  if (asset.kind === "qr") {
    if (format === "svg") { downloadBlob(`${base}.svg`, new Blob([await QRCode.toString(qrPayload(asset.data), { type: "svg", margin: 4, errorCorrectionLevel: "M", color: { dark: asset.data.color, light: "#ffffff" } })], { type: "image/svg+xml" })); return "SVG downloaded"; }
    downloadBlob(`${base}.png`, await qrPng(asset.data)); return "PNG downloaded";
  }
  if (asset.kind === "card") {
    if (format === "vcf") { downloadBlob(`${base}.vcf`, new Blob([buildVcard(asset.data)], { type: "text/vcard" })); return "vCard downloaded"; }
    const node = root?.querySelector<HTMLElement>(".cs-card");
    if (!node) throw new Error("Open the preview first.");
    await document.fonts.ready;
    downloadBlob(`${base}.png`, dataUrlToBlob(await toPng(node, { pixelRatio: 2, cacheBust: true }))); return "Card image downloaded";
  }
  if (asset.kind === "signature") {
    const html = signatureHtml(asset.data, window.location.origin);
    if (format === "html") { downloadBlob(`${base}.html`, new Blob([`<!doctype html><meta charset="utf-8">${html}`], { type: "text/html" })); return "HTML downloaded"; }
    await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([asset.data.name], { type: "text/plain" }) })]);
    return "Signature copied — paste it into your email settings";
  }
  if (asset.kind === "group") { downloadBlob(`${base}.vcf`, new Blob([buildGroupVcard(asset.data)], { type: "text/vcard" })); return "Contacts downloaded"; }
  // print package: zip the real parts
  const files: Record<string, Uint8Array> = {};
  const parts = asset.data.parts;
  if (parts.card) { const n = root?.querySelector<HTMLElement>("[data-part=card] .cs-card"); if (n) files["business-card.png"] = new Uint8Array(await dataUrlToBlob(await toPng(n, { pixelRatio: 3, cacheBust: true })).arrayBuffer()); }
  if (parts.qr) { const q = all.find((a) => a.id === asset.data.qrId && a.kind === "qr"); if (q && q.kind === "qr") files["qr-code.png"] = new Uint8Array(await (await qrPng(q.data, 1200)).arrayBuffer()); }
  if (parts.stamp) { const s = root?.querySelector<SVGSVGElement>("[data-part=stamp] svg"); if (s) files["stamp-transparent.png"] = new Uint8Array(await (await svgElementToPng(s)).arrayBuffer()); }
  if (!Object.keys(files).length) throw new Error("Choose at least one part with a source design.");
  files["README.txt"] = strToU8(`${asset.name}\nPaper: ${asset.data.paper}\nGenerated by the Card Studio prototype. Production packages add 3 mm bleed and crop marks (PDF).\n`);
  downloadBlob(`${base}.zip`, new Blob([zipSync(files) as BlobPart], { type: "application/zip" }));
  return `ZIP downloaded (${Object.keys(files).length - 1} files)`;
}
