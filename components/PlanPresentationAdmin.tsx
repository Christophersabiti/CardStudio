"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/billing/catalog";
import type { Presentation } from "./PricingPlans";
export default function PlanPresentationAdmin({
  plans,
  items,
  threshold,
}: {
  plans: Plan[];
  items: Presentation[];
  threshold: number;
}) {
  const [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  const router = useRouter();
  async function save(payload: unknown) {
    setBusy(true);
    try {
      const r = await fetch("/api/admin/presentation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) throw Error((await r.json()).error);
      setMessage("Saved and audited.");
      router.refresh();
    } catch (e) {
      setMessage((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="my-8">
      <h2 className="text-2xl mb-4">Pricing presentation & upgrades</h2>
      <p role="status">{message}</p>
      <form
        className="cs-panel my-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save({
            plan_id: null,
            body: {
              upgrade_threshold: Number(
                new FormData(e.currentTarget).get("threshold"),
              ),
            },
          });
        }}
      >
        <label>
          Near-quota threshold (%){" "}
          <input
            name="threshold"
            type="number"
            min="1"
            max="100"
            defaultValue={threshold}
            className="cs-input"
            required
          />
        </label>
        <button className="cs-button mt-3" disabled={busy}>
          Save threshold
        </button>
      </form>
      <div className="grid md:grid-cols-2 gap-4">
        {plans.map((p) => {
          const m = items.find((i) => i.plan_id === p.id);
          return (
            <form
              key={p.id}
              className="cs-panel grid gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                void save({
                  plan_id: p.id,
                  body: {
                    audience: f.get("audience"),
                    description: f.get("description"),
                    display_order: Number(f.get("display_order")),
                    recommended: f.has("recommended"),
                    upgrade_codes: f.getAll("upgrade_codes"),
                    features: [],
                  },
                });
              }}
            >
              <h3>
                {p.name} · v{p.version}
              </h3>
              <label>
                Audience
                <input
                  className="cs-input"
                  name="audience"
                  maxLength={200}
                  defaultValue={m?.audience || ""}
                />
              </label>
              <label>
                Description
                <textarea
                  className="cs-input"
                  name="description"
                  maxLength={600}
                  defaultValue={m?.description || ""}
                />
              </label>
              <label>
                Display order
                <input
                  className="cs-input"
                  name="display_order"
                  type="number"
                  min="0"
                  max="100"
                  defaultValue={m?.display_order || 0}
                />
              </label>
              <label>
                <input
                  type="checkbox"
                  name="recommended"
                  defaultChecked={m?.recommended}
                />{" "}
                Recommended plan
              </label>
              <fieldset>
                <legend>Allowed upgrade destinations</legend>
                {["basic", "premium"]
                  .filter((c) => c !== p.code)
                  .map((c) => (
                    <label key={c} className="mr-4">
                      <input
                        type="checkbox"
                        name="upgrade_codes"
                        value={c}
                        defaultChecked={m?.upgrade_codes.includes(c)}
                      />{" "}
                      {c}
                    </label>
                  ))}
              </fieldset>
              <p className="text-sm cs-muted">
                Destinations must also have an enabled price and sufficient
                capacity. Purchased limits are unchanged.
              </p>
              <button className="cs-button" disabled={busy}>
                Save presentation
              </button>
            </form>
          );
        })}
      </div>
    </section>
  );
}
