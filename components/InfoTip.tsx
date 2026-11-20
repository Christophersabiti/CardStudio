"use client";
import { useEffect, useId, useRef, useState } from "react";

/**
 * A small "?" button that explains a term. Opens on tap or click (not hover only),
 * so it works on phones and with a keyboard. Escape or tapping elsewhere closes it.
 */
export default function InfoTip({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => { if (!root.current?.contains(e.target as Node)) setOpen(false); };
    const escape = (e: KeyboardEvent) => { if (e.key === "Escape") { setOpen(false); button.current?.focus(); } };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  return (
    <span ref={root} className="cs-tip">
      <button
        ref={button}
        type="button"
        className="cs-tip-button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        ?
      </button>
      {open && (
        <span id={id} role="note" className="cs-tip-bubble">
          <strong>{label}</strong>
          <span>{children}</span>
        </span>
      )}
    </span>
  );
}
