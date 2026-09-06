"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function FreePlanAction() {
  const router = useRouter();
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <button
        className="cs-button cs-primary"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const r = await fetch("/api/onboarding", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ plan: "free" }),
            });
            if (!r.ok)
              throw Error("Could not confirm the plan. Please try again.");
            router.push("/studio");
            router.refresh();
          } catch (e) {
            setError((e as Error).message);
            setBusy(false);
          }
        }}
      >
        Continue with Free
      </button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
