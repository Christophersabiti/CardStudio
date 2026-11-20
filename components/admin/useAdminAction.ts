"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

/** Posts one administrative action, then refreshes the server-rendered admin page. */
export function useAdminAction() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  async function run(payload: unknown, success: string) {
    setBusy(true);
    setMessage(null);
    try {
      const r = await fetch("/api/admin/commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await r.json().catch(() => ({}));
      if (!r.ok) throw Error(b.error || "Could not save.");
      setMessage({ text: success, error: false });
      router.refresh();
      return true;
    } catch (e) {
      setMessage({ text: e instanceof Error ? e.message : "Could not save.", error: true });
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, run };
}
