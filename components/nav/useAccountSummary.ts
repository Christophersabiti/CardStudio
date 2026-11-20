"use client";
import { useEffect, useSyncExternalStore } from "react";
import type { AccountSummary } from "@/lib/billing/account-summary";

/**
 * One shared /api/usage request for the header badge, account menu and usage banner.
 * The last result is kept per Clerk user in sessionStorage so the badge does not
 * flash empty on every page change; it is refreshed on load, focus and after creating items.
 */
type Listener = (s: AccountSummary | null) => void;
let current: AccountSummary | null = null;
let currentKey = "";
let inflight: Promise<void> | null = null;
const listeners = new Set<Listener>();
const storageKey = (key: string) => `card_studio_plan:${key}`;

function publish(s: AccountSummary | null) {
  current = s;
  listeners.forEach((l) => l(s));
}

function load(key: string) {
  if (inflight) return inflight;
  inflight = fetch("/api/usage", { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .then((s: AccountSummary | null) => {
      if (key !== currentKey) return;
      const valid = s && s.plan ? s : null;
      try {
        if (valid) sessionStorage.setItem(storageKey(key), JSON.stringify(valid));
        else sessionStorage.removeItem(storageKey(key));
      } catch { /* Storage may be unavailable; the live value still shows. */ }
      publish(valid);
    })
    .catch(() => {})
    .finally(() => { inflight = null; });
  return inflight;
}

function subscribe(listener: () => void) {
  const l: Listener = () => listener();
  listeners.add(l);
  return () => { listeners.delete(l); };
}

/** `userKey` is the signed-in Clerk user id, or null when signed out. */
export function useAccountSummary(userKey: string | null): AccountSummary | null {
  const snapshot = useSyncExternalStore(subscribe, () => current, () => null);

  useEffect(() => {
    if (!userKey) {
      currentKey = "";
      publish(null);
      return;
    }
    if (userKey !== currentKey) {
      currentKey = userKey;
      let cached: AccountSummary | null = null;
      try { cached = JSON.parse(sessionStorage.getItem(storageKey(userKey)) || "null"); } catch { cached = null; }
      publish(cached);
    }
    void load(userKey);
    const refresh = () => void load(userKey);
    window.addEventListener("card-studio-usage", refresh);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("card-studio-usage", refresh);
      window.removeEventListener("focus", refresh);
    };
  }, [userKey]);

  return userKey && userKey === currentKey ? snapshot : null;
}
