import "server-only";
import { createAdminClient } from "@/lib/supabase/server";
import { HttpError } from "@/lib/http";
import { featureKeys } from "@/lib/billing/validation";

export type FeatureKey = (typeof featureKeys)[number];
export type FeatureFlags = Record<FeatureKey, boolean>;

const names: Record<FeatureKey, string> = {
  cards: "Business cards",
  groups: "Team contacts",
  qr_codes: "QR Studio",
  email_signature: "Email signatures",
  stamps: "The e-stamp maker",
  print_package: "Print packages",
};
export const featureName = (key: FeatureKey) => names[key];

/**
 * Current product switches. Fails open: if the switches cannot be read (for example
 * before the migration is applied), every product stays available rather than the
 * whole site going dark. Switches are a convenience, not a security boundary.
 */
export async function featureFlags(): Promise<FeatureFlags> {
  const all = Object.fromEntries(featureKeys.map((k) => [k, true])) as FeatureFlags;
  try {
    const { data, error } = await createAdminClient().from("feature_flags").select("key,enabled");
    if (error || !data) return all;
    for (const row of data) if (row.key in all) all[row.key as FeatureKey] = row.enabled;
  } catch {
    /* Keep defaults. */
  }
  return all;
}

/** For API handlers: refuse new work in a switched-off product. */
export async function requireFeature(key: FeatureKey) {
  if (!(await featureFlags())[key]) throw new HttpError(503, `${names[key]}: temporarily unavailable. Please try again later.`);
}
