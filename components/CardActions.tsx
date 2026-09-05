"use client";

import { useState } from "react";
import { downloadBlob } from "@/lib/download";
import { saveCardAsPng } from "@/lib/captureCard";
import { downloadQrCard } from "@/lib/downloadQrCard";

const btn =
  "flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition border";

export default function CardActions({
  vcard,
  qrUrl,
  fileBase,
  firstName,
  lastName,
  qrAccent,
}: {
  vcard: string;
  qrUrl: string;
  fileBase: string;
  firstName: string;
  lastName: string;
  qrAccent: string;
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
    toast("Contact file downloaded");
  }
  async function saveQr() {
    if (!qrUrl) return;
    setSaving(true);
    try {
      await downloadQrCard({
        qrUrl,
        firstName,
        lastName,
        accentColor: qrAccent,
        filename: `${fileBase}_QR.png`,
      });
      toast("Named QR image saved");
    } catch {
      toast("Could not save QR image");
    } finally {
      setSaving(false);
    }
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
          disabled={saving}
        >
          {saving ? "Savingâ€¦" : "Save QR image"}
        </button>
        <button
          className={btn}
          style={{ background: "var(--field)", borderColor: "var(--field-line)", color: "var(--ink)" }}
          onClick={copyVcard}
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
