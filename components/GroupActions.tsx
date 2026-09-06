"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useExportAccess, verifyExport } from "./SessionGuard";
import { downloadBlob, dataUrlToBlob } from "@/lib/download";
import { saveCardAsPng } from "@/lib/captureCard";

const btn =
  "flex-1 min-w-[130px] inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold cursor-pointer transition border";

export default function GroupActions({
  vcard,
  qrUrl,
  fileBase,
  disabled = false,
  memberCount,
}: {
  vcard: string;
  qrUrl: string;
  fileBase: string;
  disabled?: boolean;
  memberCount: number;
}) {
  const access = useExportAccess();
  const container = useRef<HTMLDivElement>(null);
  disabled = disabled || !access;
  async function permitted() {
    if (disabled || !(await verifyExport())) {
      toast("Sign in to save or download.");
      return false;
    }
    return true;
  }
  const [msg, setMsg] = useState<string>("");
  const [saving, setSaving] = useState(false);

  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  function toast(t: string) {
    setMsg(t);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(""), 3000);
  }

  async function saveVcf() {
    if (!(await permitted())) return;
    downloadBlob(
      `${fileBase}.vcf`,
      new Blob([vcard], { type: "text/vcard;charset=utf-8" }),
    );
    toast(
      `${memberCount} ${memberCount === 1 ? "contact" : "contacts"} downloaded`,
    );
  }
  async function saveQr() {
    if (!(await permitted())) return;
    if (!qrUrl) return;
    downloadBlob(`${fileBase}_QR.png`, dataUrlToBlob(qrUrl));
    toast("QR image saved");
  }
  async function copyVcard() {
    if (!(await permitted())) return;
    try {
      await navigator.clipboard.writeText(vcard);
      toast("vCard copied");
    } catch {
      toast("Copy not available");
    }
  }
  async function saveDigitalCard() {
    if (!(await permitted())) return;
    setSaving(true);
    try {
      await saveCardAsPng(
        container.current
          ?.closest("[data-card-surface]")
          ?.querySelector<HTMLElement>(".cs-print") || null,
        `${fileBase}_card.png`,
      );
      toast("Card image saved");
    } catch {
      toast("Could not save image");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="w-full" ref={container}>
      {!access && (
        <p className="text-sm cs-muted mb-3">
          Sign in to save or download your card.{" "}
          <Link className="underline" href="/sign-in">
            Sign in
          </Link>
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          className={btn + " text-white disabled:opacity-60"}
          style={{
            background: "var(--brand-primary)",
            borderColor: "var(--brand-primary)",
          }}
          onClick={saveVcf}
          disabled={disabled || memberCount === 0}
        >
          Add all to contacts
        </button>
        {qrUrl ? (
          <button
            className={btn}
            style={{
              background: "var(--field)",
              borderColor: "var(--field-line)",
              color: "var(--ink)",
            }}
            disabled={disabled || !qrUrl}
            onClick={saveQr}
          >
            Save QR image
          </button>
        ) : null}
        <button
          className={btn + " disabled:opacity-60"}
          style={{
            background: "var(--field)",
            borderColor: "var(--field-line)",
            color: "var(--ink)",
          }}
          onClick={copyVcard}
          disabled={disabled || memberCount === 0}
        >
          Copy vCard
        </button>
        <button
          className={btn + " disabled:opacity-60"}
          style={{
            background: "var(--field)",
            borderColor: "var(--field-line)",
            color: "var(--ink)",
          }}
          onClick={saveDigitalCard}
          disabled={disabled || saving || !qrUrl}
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
