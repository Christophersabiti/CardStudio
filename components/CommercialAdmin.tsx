"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Plan } from "@/lib/billing/catalog";
type Settings = {
  quotas_enabled: boolean;
  checkout_enabled: boolean;
  trial_enabled: boolean;
  trial_days: number;
  trial_plan_id: string | null;
};
export default function CommercialAdmin({
  settings,
  plans,
  accounts,
  section = "settings",
}: {
  section?: "settings" | "plans" | "accounts";
  settings: Settings;
  plans: Plan[];
  accounts: {
    id: string;
    app_role: string;
    status: string;
    clerk_user_id: string | null;
    profiles: { display_name: string } | null;
  }[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  async function save(payload: unknown) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/commercial", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const b = await r.json();
      if (!r.ok) throw Error(b.error);
      setMessage("Saved. Changes are recorded in the audit log.");
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <p role="status" className="my-4">
        {message}
      </p>
      <div className="grid lg:grid-cols-2 gap-5">
        {section === "settings" && (
          <form
            className="cs-panel"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              void save({
                action: "settings",
                body: {
                  quotas_enabled: f.has("quotas_enabled"),
                  checkout_enabled: f.has("checkout_enabled"),
                  trial_enabled: f.has("trial_enabled"),
                  trial_days: Number(f.get("trial_days")),
                  trial_plan_id: f.get("trial_plan_id"),
                },
              });
            }}
          >
            <h2 className="text-xl mb-5">Usage, checkout & trials</h2>
            <fieldset disabled={busy} className="grid gap-4">
              {[
                ["quotas_enabled", "Enforce creation and storage quotas"],
                ["checkout_enabled", "Enable paid checkout"],
                ["trial_enabled", "Offer a free trial"],
              ].map(([key, label]) => (
                <label className="flex gap-3" key={key}>
                  <input
                    type="checkbox"
                    name={key}
                    defaultChecked={settings[key as keyof Settings] === true}
                  />
                  {label}
                </label>
              ))}
              <label className="grid gap-1">
                Trial length (days)
                <input
                  className="cs-input"
                  type="number"
                  name="trial_days"
                  min="1"
                  max="90"
                  required
                  defaultValue={settings.trial_days}
                />
              </label>
              <label className="grid gap-1">
                Trial plan
                <select
                  className="cs-input"
                  name="trial_plan_id"
                  defaultValue={settings.trial_plan_id || ""}
                >
                  <option value="">Choose a plan</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · version {p.version}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-sm cs-muted">
                Changes apply to new trials. Existing trials retain their
                original dates and limits. Expired trials fall back to Free.
                Existing content is retained when a user exceeds the new limit.
              </p>
              <button className="cs-button cs-primary">Save settings</button>
            </fieldset>
          </form>
        )}
        {section === "plans" && (
          <form
            className="cs-panel"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              const body: Record<string, unknown> = Object.fromEntries(f);
              for (const k of [
                "active_cards",
                "active_groups",
                "active_qr_codes",
                "monthly_cards",
                "monthly_qr_codes",
                "storage_bytes",
                "amount_minor",
                "currency_exponent",
              ])
                body[k] = Number(body[k]);
              body.enabled = f.has("enabled");
              void save({ action: "plan", body });
            }}
          >
            <h2 className="text-xl mb-2">Create a plan version</h2>
            <p className="cs-muted text-sm mb-4">
              New versions preserve the terms of existing paid subscriptions.
              Enabling a version replaces that plan’s current catalog listing.
            </p>
            <fieldset disabled={busy} className="grid sm:grid-cols-2 gap-3">
              <label className="grid gap-1">
                Plan
                <select name="code" className="cs-input">
                  <option value="basic">Basic</option>
                  <option value="premium">Premium</option>
                  <option value="free">Free</option>
                </select>
              </label>
              <label className="grid gap-1">
                Display name
                <input
                  name="name"
                  className="cs-input"
                  required
                  maxLength={60}
                />
              </label>
              {[
                ["active_cards", "Active cards", 5],
                ["active_groups", "Active groups", 5],
                ["active_qr_codes", "Active standalone QR codes", 20],
                ["monthly_cards", "Monthly new cards", 25],
                ["monthly_qr_codes", "Monthly new QR codes", 100],
                ["storage_bytes", "Storage in bytes", 50000000],
              ].map(([key, label, value]) => (
                <label className="grid gap-1 text-sm" key={key}>
                  {label}
                  <input
                    className="cs-input"
                    type="number"
                    name={String(key)}
                    min="0"
                    required
                    defaultValue={value}
                  />
                </label>
              ))}
              <label className="grid gap-1">
                Currency
                <select name="currency" className="cs-input">
                  <option>UGX</option>
                  <option>KES</option>
                  <option>USD</option>
                </select>
              </label>
              <label className="grid gap-1">
                Decimal places
                <select name="currency_exponent" className="cs-input">
                  <option value="0">0 · UGX</option>
                  <option value="2">2 · KES / USD</option>
                </select>
              </label>
              <label className="grid gap-1">
                Price in minor units
                <input
                  type="number"
                  min="1"
                  name="amount_minor"
                  defaultValue="20000"
                  required
                  className="cs-input"
                />
              </label>
              <label className="grid gap-1">
                Billing period
                <select className="cs-input" name="interval">
                  <option value="month">Month</option>
                  <option value="year">Year</option>
                </select>
              </label>
              <label className="flex items-center gap-3">
                <input type="checkbox" name="enabled" />
                Enable this version
              </label>
              <button className="cs-button cs-primary">
                Create plan version
              </button>
            </fieldset>
          </form>
        )}
      </div>
      {section === "accounts" && (
        <>
          <h2 className="text-2xl mt-10 mb-5">Account access</h2>
          <p className="cs-muted text-sm mb-4">
            Only superadmins can change roles, suspend access, or configure
            commercial terms. You cannot change your own access here.
          </p>
          <div className="grid gap-3">
            {accounts.map((a) => (
              <form
                key={a.id}
                className="cs-panel flex flex-wrap items-end gap-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  const f = new FormData(e.currentTarget);
                  void save({
                    action: "account",
                    target: a.id,
                    body: {
                      app_role: f.get("app_role"),
                      status: f.get("status"),
                    },
                  });
                }}
              >
                <div className="flex-1 min-w-0">
                  <strong>{a.profiles?.display_name || "Account"}</strong>
                  <p className="text-xs cs-muted break-all">
                    {a.clerk_user_id || "Legacy identity pending link"} · {a.id}
                  </p>
                </div>
                <label className="grid gap-1 text-sm">
                  Role
                  <select
                    aria-label={`Role for ${a.id}`}
                    className="cs-input"
                    name="app_role"
                    defaultValue={a.app_role}
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">Superadmin</option>
                  </select>
                </label>
                <label className="grid gap-1 text-sm">
                  Access
                  <select
                    className="cs-input"
                    name="status"
                    defaultValue={a.status}
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                    {a.status === "deleted" && (
                      <option value="deleted">Deleted</option>
                    )}
                  </select>
                </label>
                <button
                  disabled={busy || a.status === "deleted"}
                  className="cs-button"
                >
                  Save account
                </button>
              </form>
            ))}
          </div>
        </>
      )}
    </>
  );
}
