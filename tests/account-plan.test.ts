import test from "node:test";
import assert from "node:assert/strict";
import { describePlan, planBadgeText, planSentence } from "../lib/billing/account-plan";

const now = Date.parse("2026-11-20T12:00:00.000Z");
const inDays = (n: number) => new Date(now + n * 86_400_000).toISOString();
const premium = { code: "premium", name: "Premium" };
const free = { code: "free", name: "Free" };

test("free account has no end date", () => {
  const p = describePlan({ plan: free, subscription: { status: "free", current_period_end: null, provider: null }, trial: null, now });
  assert.deepEqual([p.source, p.endsAt, p.daysLeft, p.expiringSoon], ["free", null, null, false]);
  assert.equal(planBadgeText(p), "Free plan");
});

test("active paid period wins over a running trial", () => {
  const p = describePlan({ plan: premium, subscription: { status: "active", current_period_end: inDays(30), provider: "pesapal" }, trial: { ends_at: inDays(5) }, now });
  assert.equal(p.source, "paid");
  assert.equal(p.daysLeft, 30);
  assert.equal(p.expiringSoon, false);
  assert.match(planBadgeText(p), /^Premium · until /);
});

test("manual grants are reported as manual", () => {
  const p = describePlan({ plan: premium, subscription: { status: "active", current_period_end: inDays(3), provider: "manual" }, trial: null, now });
  assert.equal(p.source, "manual");
  assert.equal(p.expiringSoon, true);
  assert.equal(planBadgeText(p), "Premium · 3 days left");
  assert.match(planSentence(p), /activated by an administrator/);
});

test("running trial shows days left, rounded up", () => {
  const p = describePlan({ plan: { code: "basic", name: "Basic" }, subscription: null, trial: { ends_at: inDays(4.2) }, now });
  assert.equal(p.source, "trial");
  assert.equal(planBadgeText(p), "Basic trial · 5 days left");
});

test("expired period or trial falls back to the plan given, as Free", () => {
  const p = describePlan({ plan: free, subscription: { status: "active", current_period_end: inDays(-1), provider: "pesapal" }, trial: { ends_at: inDays(-2) }, now });
  assert.equal(p.source, "free");
});

test("superadmins are unlimited", () => {
  const p = describePlan({ plan: free, subscription: null, trial: null, unlimited: true, now });
  assert.deepEqual([p.source, planBadgeText(p)], ["unlimited", "Superadmin"]);
});

test("one day left uses the singular", () => {
  const p = describePlan({ plan: premium, subscription: { status: "active", current_period_end: inDays(0.5), provider: "pesapal" }, trial: null, now });
  assert.equal(planBadgeText(p), "Premium · 1 day left");
});
