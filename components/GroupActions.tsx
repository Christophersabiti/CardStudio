"use client";

import { useState } from "react";
import { downloadBlob, dataUrlToBlob } from "@/lib/download";
import { saveCardAsPng } from "@/lib/captureCard";

const btn =
  "flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition border";

export default function GroupActions({
  vcard,
  qrUrl,
  fileBase,
  memberCount,
}: {
  vcard: string;
  qrUrl: string;
  fileBase: string;
  memberCount: number;
}) {
  const [msg, setMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);

  function toast(t: string) {
    setMsg(t);
    window.clearTimeout((toast as unknown as { _t?: number })._t);
    (toast as unknown as { _t?: number })._t = window.setTimeout(() => setMsg(""), 1900);
  }

  function saveVcf() {
    downloadBlob(`${fileBase}.vcf`, new Blob([vcard], { type: "text/vcard;charset=utf-8" }));
    toast(`${memberCount} ${memberCount === 1 ? "contact" : "contacts"} downloaded`);
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
  async function saveDigitalCard() {
    setSaving(true);
    try {
      await saveCardAsPng(".cs-print", `${fileBase}_card.png`);
      toast("Card image saved");
    } catch {
      toast("Could not save image");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap gap-2">
        <button
          className={btn + " text-white disabled:opacity-60"}
          style={{ background: "var(--brand-primary)", borderColor: "var(--brand-primary)" }}
          onClick={saveVcf}
          disabled={memberCount === 0}
        >
          Add all to contacts
        </button>
        {qrUrl ? (
          <button
            className={btn}
            style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
            onClick={saveQr}
          >
            Save QR image
          </button>
        ) : null}
        <button
          className={btn + " disabled:opacity-60"}
          style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
          onClick={copyVcard}
          disabled={memberCount === 0}
        >
          Copy vCard
        </button>
        <button
          className={btn + " disabled:opacity-60"}
          style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
          onClick={saveDigitalCard}
          disabled={saving}
        >
          {saving ? "Saving…" : "Save Digital Card"}
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
