"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
export default function BillingActions({
  priceId,
  trial = false,
  disabled = false,
}: {
  priceId?: string;
  trial?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const request = useRef<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        className="cs-button cs-primary"
        disabled={busy || disabled}
        onClick={async () => {
          setBusy(true);
          setError("");
          try {
            request.current ??= crypto.randomUUID();
            const r = await fetch(
              trial ? "/api/billing/trial" : "/api/billing/checkout",
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  price_id: priceId,
                  request_id: request.current,
                }),
              },
            );
            const b = await r.json();
            if (!r.ok) throw Error(b.error);
            if (trial) router.refresh();
            else window.location.assign(b.url);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Please try again.");
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy
          ? "Please wait…"
          : trial
            ? "Start free trial"
            : disabled
              ? "Checkout unavailable"
              : "Pay with Pesapal"}
      </button>
      {error && (
        <p role="alert" className="cs-error mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
