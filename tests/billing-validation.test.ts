import test from "node:test";
import assert from "node:assert/strict";
import {
  adminSchema,
  verifiedAmountMinor,
  trustedPesapalRedirect,
} from "../lib/billing/validation";
test("payment amount verification uses exact minor units and rejects invalid values", () => {
  assert.equal(verifiedAmountMinor("20000.00", 0), 20000);
  assert.equal(verifiedAmountMinor("10.25", 2), 1025);
  for (const value of ["-1", "1e5", "10.251", null])
    assert.throws(() => verifiedAmountMinor(value, 2));
});
test("checkout redirects must stay on the configured Pesapal host", () => {
  assert.ok(trustedPesapalRedirect("https://pay.pesapal.com/checkout", "live"));
  for (const url of [
    "https://pay.pesapal.com.evil.test",
    "http://pay.pesapal.com",
    "https://evil.test",
    "https://user@pay.pesapal.com",
  ])
    assert.throws(() => trustedPesapalRedirect(url, "live"));
});
test("settings reject unexpected fields and trial lengths outside bounds", () => {
  assert.equal(
    adminSchema.safeParse({
      action: "settings",
      body: {
        quotas_enabled: true,
        checkout_enabled: false,
        trial_enabled: false,
        trial_days: 14,
        trial_plan_id: "",
      },
    }).success,
    true,
  );
  assert.equal(
    adminSchema.safeParse({
      action: "account",
      target: "bad",
      body: { app_role: "superadmin", status: "active" },
    }).success,
    false,
  );
});
