"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { safeNext } from "@/lib/validation";
import { useAuth, useClerk } from "@clerk/nextjs";
import {
  createSessionMonitor,
  SESSION_WARNING_SECONDS,
  SESSION_CHECK_INTERVAL,
  SESSION_ACTIVITY_INTERVAL,
} from "@/lib/session-monitor";
const Access = createContext(false);
export const useExportAccess = () => useContext(Access);
export async function verifyExport() {
  try {
    const r = await fetch("/api/session", { cache: "no-store" });
    return r.ok && (await r.json()).active === true;
  } catch {
    return false;
  }
}
function SessionGuardSession({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const clerk = useClerk();
  const [allowed, setAllowed] = useState(false);
  const [seconds, setSeconds] = useState(900);
  const [locked, setLocked] = useState(false);
  const [renewing, setRenewing] = useState(false);
  const [renewError, setRenewError] = useState("");
  const renew = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;
    let live = true,
      ending = false,
      deadline = 0,
      lastSent = 0;
    let trailing: ReturnType<typeof setTimeout> | undefined;
    const channel =
      typeof BroadcastChannel !== "undefined"
        ? new BroadcastChannel("card-studio-session")
        : null;
    function clearPrivate() {
      try {
        for (const k of Object.keys(localStorage))
          if (k.startsWith("card_studio_v2:") && !k.includes(":guest:"))
            localStorage.removeItem(k);
      } catch {
        /* Storage restrictions must not prevent logout. */
      }
    }
    async function logout() {
      if (!live || ending) return;
      ending = true;
      monitor.stop();
      setAllowed(false);
      setLocked(true);
      clearPrivate();
      channel?.postMessage({ sid: sessionId, logout: true });
      await fetch("/api/session", {
        method: "DELETE",
        signal: AbortSignal.timeout(5000),
      }).catch(() => {});
      await clerk
        .signOut({
          redirectUrl:
            "/sign-in?reason=idle&next=" +
            encodeURIComponent(
              safeNext(window.location.pathname + window.location.search),
            ),
        })
        .catch(() => {
          window.location.replace(
            new URL("/sign-in?reason=idle", window.location.origin),
          );
        });
    }
    const monitor = createSessionMonitor({
      request: async (touch) => {
        const r = await fetch("/api/session", {
          method: touch ? "POST" : "GET",
          cache: "no-store",
          signal: AbortSignal.timeout(10_000),
        });
        return r.ok
          ? { status: r.status, ...(await r.json()) }
          : { status: r.status };
      },
      onVerified: (value) => {
        if (!live || ending) return;
        deadline = value;
        setSeconds(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
        setAllowed(true);
        setRenewError("");
        channel?.postMessage({ sid: sessionId, deadline });
      },
      onUnavailable: () => {
        if (!live || ending) return;
        // Keep the page and edits mounted. Protected operations still fail closed.
        setAllowed(false);
        if (deadline && Date.now() >= deadline) void logout();
      },
      onExpired: () => {
        void logout();
      },
    });
    renew.current = async () => {
      setRenewing(true);
      setRenewError("");
      const previous = deadline;
      await monitor.check(true);
      if (!live || ending) return;
      setRenewing(false);
      if (deadline <= previous)
        setRenewError(
          "Could not renew your session. Check your connection and try again.",
        );
    };
    function sendActivity() {
      if (!live || ending) return;
      lastSent = Date.now();
      void monitor.check(true);
    }
    function activity(e: Event) {
      if (!e.isTrusted || document.visibilityState !== "visible" || ending)
        return;
      if (
        Date.now() - lastSent >= SESSION_ACTIVITY_INTERVAL ||
        (deadline && deadline - Date.now() <= SESSION_WARNING_SECONDS * 1000)
      ) {
        clearTimeout(trailing);
        trailing = undefined;
        sendActivity();
      } else if (!trailing) {
        // One trailing renewal per burst; continuous input never floods the server.
        trailing = setTimeout(
          () => {
            trailing = undefined;
            sendActivity();
          },
          SESSION_ACTIVITY_INTERVAL - (Date.now() - lastSent),
        );
      }
    }
    function resume() {
      if (document.visibilityState === "visible") void monitor.check();
    }
    if (channel)
      channel.onmessage = (e) => {
        if (e.data?.sid !== sessionId) return;
        if (e.data.logout) {
          void logout();
          return;
        }
        if (
          typeof e.data.deadline === "number" &&
          e.data.deadline <= Date.now() + 900_000
        )
          monitor.acceptDeadline(e.data.deadline);
      };
    void monitor.check();
    const timer = setInterval(() => {
      if (!deadline || ending) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setSeconds(remaining);
      // Reconcile another tab's renewal before treating a local timer as expiration.
      if (remaining === 0) void monitor.check();
    }, 1000);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") void monitor.check();
    }, SESSION_CHECK_INTERVAL);
    const events = [
      "pointerdown",
      "pointermove",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true }),
    );
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      live = false;
      monitor.stop();
      clearInterval(timer);
      clearInterval(poll);
      clearTimeout(trailing);
      events.forEach((e) => window.removeEventListener(e, activity));
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      channel?.close();
    };
  }, [isLoaded, isSignedIn, sessionId, clerk]);
  return (
    <Access.Provider value={!!isSignedIn && allowed && !locked}>
      {locked ? (
        <main className="cs-panel m-8">Session expired. Signing you out…</main>
      ) : (
        children
      )}
      {isSignedIn &&
        seconds > 0 &&
        seconds <= SESSION_WARNING_SECONDS &&
        !locked && (
          <div className="cs-idle-warning" role="alert">
            <p>
              You’ve been inactive. You’ll be signed out in{" "}
              {Math.ceil(seconds / 60)} {seconds > 60 ? "minutes" : "minute"}.
            </p>
            <button
              className="cs-button cs-primary"
              disabled={renewing}
              onClick={() => void renew.current()}
            >
              {renewing ? "Staying signed in…" : "Stay signed in"}
            </button>
            {renewError && <p role="status">{renewError}</p>}
          </div>
        )}
    </Access.Provider>
  );
}
export default function SessionGuard({
  children,
}: {
  children: React.ReactNode;
}) {
  const { sessionId } = useAuth();
  return (
    <SessionGuardSession key={sessionId || "guest"}>
      {children}
    </SessionGuardSession>
  );
}
