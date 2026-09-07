/** Database contracts for the additive SaaS foundation.
 * These do not enable Clerk, checkout, pricing UI or quota enforcement.
 * owner_id is an internal users.id UUID, never a Clerk subject supplied by a client.
 */
export type PlanCode = "free" | "basic" | "premium";
export type BillingInterval = "month" | "year";
export type PaymentProvider = "pesapal" | "paypal";
export type SubscriptionStatus = "free" | "active" | "past_due" | "expired" | "canceled";
export type PaymentStatus = "pending" | "completed" | "failed" | "invalid" | "reversed" | "refunded";
export type UsageMetric = "active_cards" | "active_qr_codes" | "active_groups" | "storage_bytes" | "monthly_cards" | "monthly_qr_codes";
export type QrContentType = "event" | "links" | "image" | "video" | "url" | "contact" | "wifi" | "email" | "phone" | "whatsapp" | "location" | "document" | "text";
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

export interface AppUser {
  id: string;
  clerk_user_id: string | null;
  legacy_supabase_user_id: string | null;
  status: "active" | "disabled" | "deleted";
  app_role: "member" | "admin";
  clerk_disabled: boolean;
  clerk_event_at: number;
  created_at: string;
  updated_at: string;
}

export interface AppProfile {
  user_id: string;
  display_name: string;
  business_name: string;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface PlanRecord {
  id: string;
  code: PlanCode;
  version: number;
  name: string;
  enabled: boolean;
  active_cards: number;
  active_qr_codes: number;
  active_groups: number;
  monthly_cards: number;
  monthly_qr_codes: number;
  storage_bytes: number;
  features: {
    custom_colors: boolean;
    qr_logo: boolean;
    remove_branding: boolean;
    qr_svg: boolean;
    analytics: "none" | "totals";
  };
  created_at: string;
}

/** Money is integer minor units. Reject values outside Number.isSafeInteger
 * at the future API boundary; never perform billing with floating point units.
 */
export interface PlanPriceRecord {
  id: string;
  plan_id: string;
  currency: string;
  currency_exponent: number;
  interval: BillingInterval;
  amount_minor: number;
  enabled: boolean;
  created_at: string;
}

export interface SubscriptionRecord {
  id: string;
  owner_id: string;
  plan_id: string;
  price_id: string | null;
  status: SubscriptionStatus;
  current_period_start: string | null;
  current_period_end: string | null;
  renewal_mode: "manual" | "provider";
  cancel_at_period_end: boolean;
  provider: PaymentProvider | null;
  provider_subscription_id: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
}

export interface BillingOrderRecord {
  id: string;
  owner_id: string;
  subscription_id: string;
  price_id: string;
  purpose: "initial" | "renewal" | "upgrade";
  status: "pending" | "paid" | "canceled" | "expired" | "refunded";
  amount_minor: number;
  currency: string;
  currency_exponent: number;
  price_snapshot: { [key: string]: Json };
  idempotency_key: string;
  subscription_revision: number;
  expires_at: string;
  fulfilled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentRecord {
  id: string;
  owner_id: string;
  order_id: string;
  provider: PaymentProvider;
  provider_tracking_id: string | null;
  merchant_reference: string;
  status: PaymentStatus;
  amount_minor: number;
  currency: string;
  currency_exponent: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface QrCodeRecord {
  id: string;
  owner_id: string;
  slug: string;
  type: QrContentType;
  mode: "static" | "dynamic";
  title: string;
  caption: string;
  description: string;
  data: { [key: string]: Json };
  published: boolean;
  published_data: { [key: string]: Json } | null;
  revision: number;
  archived_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface GroupCardRecord {
  owner_id: string;
  group_id: string;
  card_id: string;
  position: number;
  created_at: string;
}

export interface UsageCounterRecord {
  owner_id: string;
  metric: UsageMetric;
  /** current for active/storage metrics; YYYY-MM in UTC for monthly metrics. */
  period_key: string;
  value: number;
  updated_at: string;
}

export interface SubscriptionEventRecord {
  id: string;
  owner_id: string;
  subscription_id: string;
  order_id: string | null;
  event_key: string;
  event_type: string;
  details: { [key: string]: Json };
  created_at: string;
}

export interface PaymentEventRecord {
  id: string;
  provider: PaymentProvider;
  deduplication_key: string;
  provider_tracking_id: string;
  payment_id: string | null;
  status: "pending" | "processing" | "processed" | "failed" | "ignored";
  attempts: number;
  next_attempt_at: string;
  locked_until: string | null;
  payload: { [key: string]: Json };
  last_error_code: string | null;
  created_at: string;
  processed_at: string | null;
}

export interface UsageEventRecord {
  id: string;
  owner_id: string;
  operation_id: string;
  metric: UsageMetric;
  period_key: string;
  delta: number;
  resource_type: "card" | "qr_code" | "group" | "media";
  resource_id: string;
  created_at: string;
}
