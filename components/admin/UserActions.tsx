"use client";
import { useState } from "react";
import type { AccountRow, GrantRow } from "@/lib/admin/accounts";
import { useAdminAction } from "./useAdminAction";

type PlanOption = { id: string; code: string; name: string };
const monthChoices = [1, 3, 6, 12];

function addMonths(from: Date, months: number) {
  const d = new Date(from);
  d.setMonth(d.getMonth() + months);
  return d;
}
const longDate = (d: Date | string) => new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

export default function UserActions({ account, grants, plans, self }: { account: AccountRow; grants: GrantRow[]; plans: PlanOption[]; self: boolean }) {
  const { busy, message, run } = useAdminAction();
  const [planId, setPlanId] = useState(plans.find((p) => p.code === "premium")?.id || plans[0]?.id || "");
  const [months, setMonths] = useState(1);
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  // Read the clock once per render pass via state so the preview is stable.
  const [now] = useState(() => Date.now());

  const chosen = plans.find((p) => p.id === planId);
  const periodEnd = account.period_end ? new Date(account.period_end) : null;
  const extending = !!(periodEnd && periodEnd.getTime() > now && chosen && account.plan_code === chosen.code && account.source !== "trial");
  const newEnd = addMonths(extending && periodEnd ? periodEnd : new Date(now), months);
  const planName = (id: string) => plans.find((p) => p.id === id)?.name || "Plan";

  async function grant(form: HTMLFormElement) {
    const f = new FormData(form);
    const amount = String(f.get("amount") || "").trim();
    const ok = await run(
      {
        action: "grant_plan",
        target: account.id,
        body: {
          plan_id: planId,
          months,
          reference: String(f.get("reference") || ""),
          note: String(f.get("note") || ""),
          amount_minor: amount ? Number(amount) : null,
          currency: amount ? String(f.get("currency")) : null,
        },
      },
      `${chosen?.name} activated until ${longDate(newEnd)}.`,
    );
    if (ok) { form.reset(); setConfirming(false); }
  }

  return (
    <div className="admin-actions">
      {message && <p role={message.error ? "alert" : "status"} className={`admin-message${message.error ? " is-error" : ""}`}>{message.text}</p>}

      {account.status === "active" && account.app_role !== "superadmin" && (
        <form
          className="admin-card"
          onSubmit={(e) => { e.preventDefault(); if (!confirming) setConfirming(true); else void grant(e.currentTarget); }}
        >
          <h3>Give a paid plan</h3>
          <p className="admin-help">Use this when the customer paid outside Card Studio, for example by mobile money, bank transfer or cash.</p>
          <fieldset disabled={busy} className="admin-form-grid">
            <label>Plan
              <select className="cs-input" value={planId} onChange={(e) => { setPlanId(e.target.value); setConfirming(false); }}>
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <div role="group" aria-label="How long" className="admin-months">
              <span>How long</span>
              <div>
                {monthChoices.map((m) => (
                  <button type="button" key={m} className="cs-button" aria-pressed={months === m} onClick={() => { setMonths(m); setConfirming(false); }}>
                    {m === 1 ? "1 month" : `${m} months`}
                  </button>
                ))}
              </div>
            </div>
            <label>Payment reference
              <input name="reference" className="cs-input" required minLength={2} maxLength={120} placeholder="e.g. MTN transaction ID" />
            </label>
            <div className="admin-form-row">
              <label>Amount received (optional)
                <input name="amount" className="cs-input" type="number" min={0} step={1} inputMode="numeric" placeholder="e.g. 50000" />
              </label>
              <label>Currency
                <select name="currency" className="cs-input" defaultValue="UGX">
                  <option>UGX</option><option>KES</option><option>USD</option>
                </select>
              </label>
            </div>
            <label>Note (optional)
              <textarea name="note" className="cs-input" maxLength={500} rows={2} placeholder="Anything worth remembering about this payment" />
            </label>
            <p className="admin-preview">
              {extending
                ? <>Adds {months === 1 ? "1 month" : `${months} months`} to the current {chosen?.name} plan. New end date: <strong>{longDate(newEnd)}</strong>.</>
                : <>{chosen?.name} starts now and ends <strong>{longDate(newEnd)}</strong>.{account.source !== "free" && " This replaces the current plan."}</>}
            </p>
            {confirming ? (
              <div className="admin-confirm">
                <strong>Activate {chosen?.name} for {account.email || account.display_name || "this user"} until {longDate(newEnd)}?</strong>
                <div>
                  <button className="cs-button cs-primary">{busy ? "Saving…" : "Yes, activate"}</button>
                  <button type="button" className="cs-button" onClick={() => setConfirming(false)}>Cancel</button>
                </div>
              </div>
            ) : (
              <button className="cs-button cs-primary">Review and activate</button>
            )}
          </fieldset>
        </form>
      )}

      <section className="admin-card">
        <h3>Plan history</h3>
        {grants.length === 0 ? <p className="admin-help">No plans have been given manually.</p> : (
          <ul className="admin-grants">
            {grants.map((g) => (
              <li key={g.id} className={g.revoked_at ? "is-revoked" : undefined}>
                <div>
                  <strong>{planName(g.plan_id)} · {g.months === 1 ? "1 month" : `${g.months} months`}</strong>
                  <small>{longDate(g.period_start)} to {longDate(g.period_end)} · Ref {g.payment_reference}{g.amount_minor !== null ? ` · ${g.currency} ${g.amount_minor.toLocaleString()}` : ""}</small>
                  {g.note && <small>{g.note}</small>}
                  {g.revoked_at && <small>Revoked {longDate(g.revoked_at)}: {g.revoke_reason}</small>}
                </div>
                {!g.revoked_at && (revoking === g.id ? (
                  <form className="admin-revoke" onSubmit={async (e) => { e.preventDefault(); if (await run({ action: "revoke_grant", target: g.id, body: { reason } }, "Grant revoked.")) { setRevoking(null); setReason(""); } }}>
                    <label>Why are you revoking it?
                      <input className="cs-input" value={reason} onChange={(e) => setReason(e.target.value)} minLength={5} maxLength={300} required placeholder="e.g. Payment reversed" />
                    </label>
                    <div>
                      <button className="cs-button" disabled={busy}>Revoke</button>
                      <button type="button" className="cs-button" onClick={() => setRevoking(null)}>Keep</button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="cs-button" onClick={() => { setRevoking(g.id); setReason(""); }}>Revoke</button>
                ))}
              </li>
            ))}
          </ul>
        )}
      </section>

      <form
        className="admin-card"
        onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          void run({ action: "account", target: account.id, body: { app_role: f.get("app_role"), status: f.get("status") } }, "Access saved.");
        }}
      >
        <h3>Role and access</h3>
        {self ? <p className="admin-help">You cannot change your own access.</p> : (
          <fieldset disabled={busy} className="admin-form-row">
            <label>Role
              <select name="app_role" className="cs-input" defaultValue={account.app_role}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
            </label>
            <label>Access
              <select name="status" className="cs-input" defaultValue={account.status}>
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>
            </label>
            <button className="cs-button">Save access</button>
          </fieldset>
        )}
      </form>
    </div>
  );
}
