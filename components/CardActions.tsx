"use client";

import { useState } from "react";

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [head, b64] = dataUrl.split(",");
  const mime = head.match(/:(.*?);/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const btn =
  "flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition border";

export default function CardActions({
  vcard,
  qrUrl,
  fileBase,
}: {
  vcard: string;
  qrUrl: string;
  fileBase: string;
}) {
  const [msg, setMsg] = useState<string>("");

  function toast(t: string) {
    setMsg(t);
    window.clearTimeout((toast as unknown as { _t?: number })._t);
    (toast as unknown as { _t?: number })._t = window.setTimeout(() => setMsg(""), 1900);
  }

  function saveVcf() {
    downloadBlob(`${fileBase}.vcf`, new Blob([vcard], { type: "text/vcard;charset=utf-8" }));
    toast("Contact file downloaded");
  }
  function saveQr() {
    if (!qrUrl) return;
    downloadBlob(`${fileBase}_QR.png`, dataUrlToBlob(qrUrl));
    toast("QR image saved");
  }
  async function copyVcard() {
    try {
      await navigator.clipboard.writeText(vcard);
      toast("vCard copied");
    } catch {
      toast("Copy not available");
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        <button
          className={btn + " text-white"}
          style={{ background: "var(--brand-primary)", borderColor: "var(--brand-primary)" }}
          onClick={saveVcf}
        >
          Add to contacts
        </button>
        <button
          className={btn}
          style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
          onClick={saveQr}
        >
          Save QR image
        </button>
        <button
          className={btn}
          style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
          onClick={copyVcard}
        >
          Copy vCard
        </button>
        <button
          className={btn}
          style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
          onClick={() => window.print()}
        >
          Print / PDF
        </button>
      </div>
      {msg ? (
        <div
          className="mt-3 text-center text-sm font-semibold"
          style={{ color: "var(--brand-primary-deep)" }}
          role="status"
        >
          {msg}
        </div>
      ) : null}
    </div>
  );
}
