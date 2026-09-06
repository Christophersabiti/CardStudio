"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { safeNext } from "@/lib/validation";
import { useAuth, useClerk } from "@clerk/nextjs";
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
function SessionGuardSession({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isLoaded, isSignedIn, sessionId } = useAuth();
  const clerk = useClerk();
  const [allowed, setAllowed] = useState(false),
    [seconds, setSeconds] = useState(900),
    [locked, setLocked] = useState(false);
  const deadline = useRef(0),
    lastSent = useRef(0),
    ending = useRef(false);
  useEffect(() => {
    if (!isLoaded || !isSignedIn || !sessionId) return;
    let live = true;
    let trailing: ReturnType<typeof setTimeout>;
    const channel = new BroadcastChannel("card-studio-session");
    const clearPrivate = () => {
      try {for (const k of Object.keys(localStorage))
        if (k.startsWith("card_studio_v2:") && !k.includes(":guest:"))
          localStorage.removeItem(k);} catch {/* Storage restrictions must not prevent logout. */}
    };
    async function logout() {
      if (ending.current) return;
      ending.current = true;
      setAllowed(false);
      setLocked(true);
      clearPrivate();
      channel.postMessage({ sid: sessionId, logout: true });
      await fetch("/api/session", { method: "DELETE", signal:AbortSignal.timeout(5000) }).catch(() => {});
      await clerk.signOut({ redirectUrl: "/sign-in?reason=idle&next="+encodeURIComponent(safeNext(window.location.pathname+window.location.search)) }).catch(() => {
        window.location.replace(
          new URL("/sign-in?reason=idle", window.location.origin),
        );
      });
    }
    async function check(touch = false) {
      try {
        const r = await fetch("/api/session", {
          method: touch ? "POST" : "GET",
          cache: "no-store",
        });
        if (!live) return;
        if (r.status === 401 || r.status === 403) {
          void logout();
          return;
        }
        if (!r.ok) {
          setAllowed(false);
          return;
        }
        const b = await r.json();
        if (!b.active) {
          void logout();
          return;
        }
        deadline.current = Date.now() + b.remaining * 1000;
        setAllowed(true);
        setLocked(false);
        channel.postMessage({ sid: sessionId, deadline: deadline.current });
      } catch {
        if (live) setAllowed(false);
      }
    }
    function activity(e: Event) {
      if (!e.isTrusted) return;
      if (deadline.current && Date.now() >= deadline.current) {
        void logout();
        return;
      }
      clearTimeout(trailing);
      if (Date.now() - lastSent.current > 5000 || deadline.current-Date.now()<1000) {
        lastSent.current = Date.now();
        void check(true);
      } else trailing=setTimeout(()=>{lastSent.current=Date.now();void check(true);},250);
    }
    function resume() {
      if (document.visibilityState === "visible") {
        setAllowed(false);
        if (deadline.current && Date.now() >= deadline.current) void logout();
        else void check();
      }
    }
    channel.onmessage = (e) => {
      if (e.data.sid !== sessionId) return;
      if (e.data.logout) {
        void logout();
        return;
      }
      if (e.data.deadline > deadline.current)
        deadline.current = e.data.deadline;
    };
    void check();
    const timer = setInterval(() => {
      if (!deadline.current) return;
      const remaining = Math.ceil((deadline.current - Date.now()) / 1000);
      setSeconds(Math.max(0, remaining));
      if (remaining <= 0) void logout();
    }, 1000);
    const events = ["pointerdown", "keydown", "scroll", "touchstart"];
    events.forEach((e) =>
      window.addEventListener(e, activity, { passive: true }),
    );
    window.addEventListener("focus", resume);
    document.addEventListener("visibilitychange", resume);
    return () => {
      live = false;
      clearInterval(timer);
      clearTimeout(trailing);
      events.forEach((e) => window.removeEventListener(e, activity));
      window.removeEventListener("focus", resume);
      document.removeEventListener("visibilitychange", resume);
      channel.close();
      clearPrivate();
    };
  }, [isLoaded, isSignedIn, sessionId, clerk]);
  return (
    <Access.Provider value={!!isSignedIn && allowed && !locked}>
      {locked ? (
        <main className="cs-panel m-8">Session expired. Signing you out…</main>
      ) : (
        <>
          <div
            style={
              isSignedIn && !allowed ? { visibility: "hidden" } : undefined
            }
          >
            {children}
          </div>
          {isSignedIn && !allowed && (
            <div className="cs-idle-warning" role="status">
              Checking your session…
            </div>
          )}
        </>
      )}
      {isSignedIn && seconds <= 60 && !locked && (
        <div className="cs-idle-warning" role="alert">
          <p>
            Your session expires in {seconds} seconds. Unfinished edits are
            recovered privately when available.
          </p>
          <button
            className="cs-button cs-primary"
            onClick={async () => {
              const r = await fetch("/api/session", { method: "POST" });
              if (r.ok) {
                const b = await r.json();
                deadline.current = Date.now() + b.remaining * 1000;
                setSeconds(Math.ceil(b.remaining));
              }
            }}
          >
            Stay signed in
          </button>
        </div>
      )}
    </Access.Provider>
  );
}

export default function SessionGuard({children}:{children:React.ReactNode}){const {sessionId}=useAuth();return <SessionGuardSession key={sessionId||"guest"}>{children}</SessionGuardSession>;}
