import { z } from "zod";
const quota = z.number().int().min(0).max(1000000);
export const settingsSchema = z
  .object({
    action: z.literal("settings"),
    body: z
      .object({
        quotas_enabled: z.boolean(),
        checkout_enabled: z.boolean(),
        trial_enabled: z.boolean(),
        trial_days: z.number().int().min(1).max(90),
        trial_plan_id: z.union([z.uuid(), z.literal("")]),
      })
      .strict(),
  })
  .strict();
export const adminSchema = z.union([
  settingsSchema,
  z
    .object({
      action: z.literal("account"),
      target: z.uuid(),
      body: z
        .object({
          app_role: z.enum(["member", "admin", "superadmin"]),
          status: z.enum(["active", "disabled"]),
        })
        .strict(),
    })
    .strict(),
  z
    .object({
      action: z.literal("plan"),
      body: z
        .object({
          code: z.enum(["free", "basic", "premium"]),
          name: z.string().trim().min(1).max(60),
          enabled: z.boolean(),
          active_cards: quota,
          active_groups: quota,
          active_qr_codes: quota,
          monthly_cards: quota,
          monthly_qr_codes: quota,
          monthly_stamps: z.union([z.literal(-1),quota]),
          storage_bytes: z.number().int().min(0).max(100000000000),
          effective_at: z.string().datetime(),
          currency: z.enum(["UGX", "KES", "USD"]),
          currency_exponent: z.number().int().min(0).max(2),
          interval: z.enum(["month", "year"]),
          amount_minor: z.number().int().min(1).max(100000000000),
        })
        .strict()
        .refine(
          (v) => v.currency_exponent === (v.currency === "UGX" ? 0 : 2),
          "UGX uses exponent 0; KES and USD use 2.",
        )
        .refine(
          (v) => v.code !== "free" || v.enabled,
          "The Free plan must stay enabled.",
        ),
    })
    .strict(),
]);
/** Actions that use their own database functions rather than admin_commercial_update. */
export const grantSchema = z
  .object({
    action: z.literal("grant_plan"),
    target: z.uuid(),
    body: z
      .object({
        plan_id: z.uuid(),
        months: z.number().int().min(1).max(24),
        reference: z.string().trim().min(2).max(120),
        note: z.string().trim().max(500).default(""),
        amount_minor: z.number().int().min(0).max(100000000000).nullable().default(null),
        currency: z.enum(["UGX", "KES", "USD"]).nullable().default(null),
      })
      .strict()
      .refine((v) => (v.amount_minor === null) === (v.currency === null), "Enter both an amount and a currency, or neither."),
  })
  .strict();
export const revokeSchema = z
  .object({
    action: z.literal("revoke_grant"),
    target: z.uuid(),
    body: z.object({ reason: z.string().trim().min(5).max(300) }).strict(),
  })
  .strict();
export const featureKeys = ["cards", "groups", "qr_codes", "email_signature", "stamps", "print_package"] as const;
export const featureSchema = z
  .object({
    action: z.literal("feature"),
    body: z.object({ key: z.enum(featureKeys), enabled: z.boolean() }).strict(),
  })
  .strict();
export const adminActionSchema = z.union([adminSchema, grantSchema, revokeSchema, featureSchema]);

export function verifiedAmountMinor(value: unknown, exponent: number) {
  if (typeof value !== "number" && typeof value !== "string")
    throw Error("Invalid amount");
  const s = String(value);
  if (!/^\d+(\.\d+)?$/.test(s)) throw Error("Invalid amount");
  const [whole, fraction = ""] = s.split(".");
  if (fraction.slice(exponent).replace(/0/g, ""))
    throw Error("Fractional minor units");
  const result =
    Number(whole) * 10 ** exponent +
    Number(fraction.slice(0, exponent).padEnd(exponent, "0"));
  if (!Number.isSafeInteger(result)) throw Error("Unsafe amount");
  return result;
}
export function trustedPesapalRedirect(value: string, environment: string) {
  const u = new URL(value);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.hostname !==
      (environment === "live" ? "pay.pesapal.com" : "cybqa.pesapal.com")
  )
    throw Error("Untrusted checkout URL");
  return u.toString();
}
