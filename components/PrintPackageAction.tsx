"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { CardData, StudioRecord } from "@/lib/types";
import { downloadBlob } from "@/lib/download";
import { contactFileBase } from "@/lib/vcard";
import { useExportAccess } from "./SessionGuard";

export default function PrintPackageAction({ record, data, signedIn, disabled, dirty, matchesPublished }: {
  record?: StudioRecord; data: CardData; signedIn: boolean; disabled: boolean; dirty: boolean; matchesPublished: boolean;
}) {
  const session = useExportAccess();
  const [access, setAccess] = useState<"loading" | "allowed" | "denied" | "error">("loading");
  const [preset, setPreset] = useState("exact");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const inFlight = useRef(false);
  const mode = data.qrMode || "dynamic";
  useEffect(() => {
    if (!signedIn || !session) return;
    let live = true;
    async function refresh() {
      try {
        const response = await fetch("/api/print-package/access", { cache: "no-store" });
        if (!response.ok) throw Error();
        const result = await response.json();
        if (live) setAccess(result.allowed ? "allowed" : "denied");
      } catch { if (live) setAccess("error"); }
    }
    void refresh();
    window.addEventListener("card-studio-usage", refresh);
    window.addEventListener("focus", refresh);
    return () => { live = false; window.removeEventListener("card-studio-usage", refresh); window.removeEventListener("focus", refresh); };
  }, [signedIn, session]);
  const reason = !record ? "Save your card first." : dirty ? "Save your changes before downloading." : mode === "dynamic" && !matchesPublished ? "Publish the current details to enable the online QR." : "";
  async function download() {
    if (!record || reason || inFlight.current || !session || access !== "allowed") return;
    inFlight.current = true; setSaving(true); setMessage("");
    try {
      const response = await fetch(`/api/cards/${record.slug}/print-package`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revision: record.revision, preset }),
      });
      if (!response.ok) {
        const result = await response.json();
        if (response.status === 403 && result.code === "plan_required") setAccess("denied");
        throw Error(result.error || "Could not prepare the print package.");
      }
      downloadBlob(`${contactFileBase(data)}-print-package-r${record.revision}-${mode === "dynamic" ? "online" : "offline"}.zip`, await response.blob());
      setMessage("Downloaded front.pdf, back.pdf, and mockup.png together.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Could not download. Try again."); }
    finally { inFlight.current = false; setSaving(false); }
  }
  return <section className="cs-panel flex flex-col gap-3" aria-label="Print package">
    <div><h2 className="font-bold">Print package</h2><p className="text-sm cs-muted">Front PDF, back PDF, and mockup PNG in one ZIP.</p></div>
    <p className="text-xs cs-muted">85.6 × 54 mm landscape · {mode === "dynamic" ? "Online profile QR" : "Offline contact QR"} · RGB artwork</p>
    {!signedIn ? <Link className="cs-button" href="/sign-in">Sign in for print packages</Link> : access === "denied" ? <><p className="text-sm cs-muted">Included with Basic and Premium.</p><Link className="cs-button cs-primary text-center" href="/pricing">Upgrade to download print package</Link></> : <>
      <label className="text-sm" htmlFor="print-preset">Printer size</label>
      <select id="print-preset" className="cs-input" value={preset} onChange={e => setPreset(e.target.value)} disabled={saving}>
        <option value="exact">Exact card size · no bleed</option><option value="bleed">3 mm bleed · for trimming</option>
      </select>
      <button type="button" className="cs-button cs-primary disabled:opacity-60" disabled={disabled || saving || !!reason || !session || access !== "allowed"} onClick={download}>
        {saving ? "Preparing 3 files…" : "Download print package"}
      </button>
      <p className="text-sm cs-muted" role="status">{!session ? "Verify your sign-in session to download." : access === "loading" ? "Checking your plan…" : access === "error" ? "Could not verify your plan. Reload or return to this window to retry." : reason}</p>
    </>}
    <p className="text-xs cs-muted">Use the PDFs at actual size. Confirm bleed and colour requirements with your printer. The mockup is a visual proof; saved downloads do not change when you edit the card.</p>
    {message && <p role="status" className="text-sm">{message}</p>}
  </section>;
}
