export function isClerkConfigured() {
  return !!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && !!process.env.CLERK_SECRET_KEY;
}

export function authorizedParties() {
  const origin = process.env.NEXT_PUBLIC_SITE_URL;
  if (!origin) throw new Error("Set NEXT_PUBLIC_SITE_URL before enabling authentication.");
  const parsed = new URL(origin);
  if (parsed.origin !== origin || !["http:", "https:"].includes(parsed.protocol)) {
    throw new Error("NEXT_PUBLIC_SITE_URL must be an origin without a trailing slash or path.");
  }
  if (parsed.protocol !== "https:" && !["localhost", "127.0.0.1"].includes(parsed.hostname)) {
    throw new Error("Non-local authentication requires HTTPS.");
  }
  return [parsed.origin];
}
