"use client";
import Link from "next/link";
import { useState } from "react";
import type { Plan, Price } from "@/lib/billing/catalog";
export type Presentation = {
  plan_id: string;
  audience: string;
  description: string;
  display_order: number;
  recommended: boolean;
  features: string[];
  upgrade_codes: string[];
};
const money = (p: Price) =>
  new Intl.NumberFormat("en-UG", {
    style: "currency",
    currency: p.currency,
    maximumFractionDigits: p.currency_exponent,
  }).format(p.amount_minor / 10 ** p.currency_exponent);
export default function PricingPlans({
  plans,
  prices,
  presentation,
  checkout,
  trialDays,
  currentPlan,
}: {
  plans: Plan[];
  prices: Price[];
  presentation: Presentation[];
  checkout: boolean;
  trialDays: number;
  currentPlan?: string;
}) {
  const [interval, setInterval] = useState("month");
  const intervals = ["month", "year"].filter((i) =>
    prices.some(
      (p) =>
        p.enabled &&
        p.interval === i &&
        plans.some((pl) => pl.id === p.plan_id),
    ),
  );
  const selected = intervals.includes(interval) ? interval : intervals[0];
  const ordered = [...plans].sort(
    (a, b) =>
      (presentation.find((p) => p.plan_id === a.id)?.display_order || 0) -
      (presentation.find((p) => p.plan_id === b.id)?.display_order || 0),
  );
  return (
    <>
      {intervals.length > 1 && (
        <div
          className="flex gap-3 my-6"
          role="group"
          aria-label="Billing period"
        >
          {intervals.map((i) => (
            <button
              key={i}
              className="cs-button"
              aria-pressed={selected === i}
              onClick={() => setInterval(i)}
            >
              {i === "month" ? "Monthly" : "Yearly"}
            </button>
          ))}
        </div>
      )}
      <div className="mk-pricing">
        {ordered.map((p) => {
          const meta = presentation.find((v) => v.plan_id === p.id);
          const offers = prices.filter(
            (v) => v.plan_id === p.id && v.enabled && v.interval === selected,
          );
          return (
            <article className="mk-price" key={p.id}>
              <p className="mk-eyebrow">
                {currentPlan === p.id
                  ? "Your current plan"
                  : meta?.recommended
                    ? "Recommended"
                    : meta?.audience || "Digital business cards"}
              </p>
              <h2>{p.name}</h2>
              <p className="my-3">{meta?.description}</p>
              {p.code === "free" ? (
                <div className="mk-price-value">Free</div>
              ) : (
                offers.map((v) => (
                  <div key={v.id}>
                    <div className="mk-price-value">
                      {money(v)}
                      <small>/{v.interval}</small>
                    </div>
                    {v.interval === "year" && (
                      <p className="text-sm">
                        Total payable annually. Equivalent to{" "}
                        {money({
                          ...v,
                          amount_minor: Math.round(v.amount_minor / 12),
                        })}
                        /month.
                      </p>
                    )}
                    {checkout ? (
                      <Link
                        className="mk-button my-4"
                        href={"/onboarding?plan=" + v.id}
                      >
                        Choose {p.name} ↗
                      </Link>
                    ) : (
                      <p className="cs-muted my-4">
                        Paid checkout is not yet available.
                      </p>
                    )}
                  </div>
                ))
              )}
              {p.code !== "free" && offers.length === 0 && (
                <p>No offer for this billing period.</p>
              )}
              <ul>
                <li>{p.active_cards} active cards</li>
                <li>{p.monthly_cards} new cards per calendar month</li>
                <li>{p.active_groups} active groups</li>
                <li>
                  {Math.round(p.storage_bytes / 1000000)} MB image storage
                </li>
                <li>Portrait and landscape layouts</li>
                <li>Private drafts and controlled publishing</li>
                {meta?.features.map((feature,i)=><li key={i}>{feature}</li>)}
              </ul>
              {p.code === "free" && (
                <Link className="mk-button" href="/onboarding?plan=free">
                  Choose Free ↗
                </Link>
              )}
            </article>
          );
        })}
      </div>
      <h2 className="text-3xl mt-14 mb-6">Compare what’s included</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left cs-comparison">
          <thead>
            <tr>
              <th>Features & capacity</th>
              {ordered.map((p) => (
                <th key={p.id}>{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["Active cards", "active_cards"],
              ["New cards per month", "monthly_cards"],
              ["Active groups", "active_groups"],
              ["Storage (MB)", "storage_bytes"],
            ].map(([label, key]) => (
              <tr key={key}>
                <th>{label}</th>
                {ordered.map((p) => (
                  <td key={p.id}>
                    {key === "storage_bytes"
                      ? Math.round(p.storage_bytes / 1000000)
                      : p[key as keyof Plan]}
                  </td>
                ))}
              </tr>
            ))}
            {[
              "Private drafts and publishing",
              "Portrait and landscape exports",
              "QR and vCard sharing after sign-in",
              "Search, list and thumbnail views",
              "15-minute idle logout",
            ].map((label) => (
              <tr key={label}>
                <th>{label}</th>
                {ordered.map((p) => (
                  <td key={p.id}>Included</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="grid md:grid-cols-2 gap-6 mt-10">
        {[
          [
            "How do limits work?",
            "Active allowances count saved cards and groups outside Trash. Monthly creation counts do not decrease when a card is deleted. Monthly usage resets at the start of each UTC calendar month.",
          ],
          [
            "What happens when a plan expires?",
            "Your saved content is retained. Free allowances apply to new creation and other constrained actions. Existing public links remain available unless unpublished or your account is suspended.",
          ],
          [
            "Will I be charged automatically?",
            "No. Payments use Pesapal and plans renew manually. Access starts only after the payment is verified.",
          ],
          [
            "Is there a free trial?",
            trialDays
              ? `Eligible accounts can start a ${trialDays}-day trial from onboarding or Billing. One trial per account; no automatic charge when it ends.`
              : "Trials are not currently enabled. You can begin with the Free plan.",
          ],
        ].map(([q, a]) => (
          <details className="cs-panel" key={q}>
            <summary className="font-bold cursor-pointer">{q}</summary>
            <p className="mt-3">{a}</p>
          </details>
        ))}
      </div>
    </>
  );
}
