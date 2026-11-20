"use client";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { tourFor, TOUR_EVENT, type Tour } from "@/lib/tours";
import "./tour.css";

const doneKey = (id: string) => `card_studio_tour:${id}`;
const isDone = (id: string) => { try { return localStorage.getItem(doneKey(id)) === "done"; } catch { return true; } };
const markDone = (id: string) => { try { localStorage.setItem(doneKey(id), "done"); } catch { /* Storage blocked: the tour just shows again next time. */ } };
const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const visible = (el: Element | null): el is HTMLElement => !!el && (el as HTMLElement).getClientRects().length > 0;

type Rect = { top: number; left: number; width: number; height: number };

/**
 * Runs the walkthrough for the current page: once automatically on a first visit
 * (remembered in this browser), and again whenever the Help menu asks for it.
 */
export default function TourHost() {
  const pathname = usePathname() || "/";
  const [tour, setTour] = useState<Tour | null>(null);
  const [index, setIndex] = useState(0);
  // Measured position of the current step's element, tagged with the step it belongs to.
  const [measured, setMeasured] = useState<{ key: string; rect: Rect | null } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);

  const start = useCallback((t: Tour) => {
    returnFocus.current = document.activeElement as HTMLElement | null;
    setIndex(0);
    setTour(t);
  }, []);
  const finish = useCallback(() => {
    if (tour) markDone(tour.id);
    setTour(null);
    returnFocus.current?.focus?.();
  }, [tour]);

  // Auto-start once per browser, after the page's first target has rendered.
  useEffect(() => {
    const t = tourFor(pathname);
    if (!t || isDone(t.id)) return;
    let tries = 0;
    const timer = window.setInterval(() => {
      tries += 1;
      const first = t.steps.find((s) => s.target)?.target;
      if (!first || visible(document.querySelector(first))) {
        window.clearInterval(timer);
        start(t);
      } else if (tries > 20) window.clearInterval(timer);
    }, 250);
    return () => window.clearInterval(timer);
  }, [pathname, start]);

  // Replay on request from the Help menu.
  useEffect(() => {
    const replay = () => { const t = tourFor(window.location.pathname); if (t) start(t); };
    window.addEventListener(TOUR_EVENT, replay);
    return () => window.removeEventListener(TOUR_EVENT, replay);
  }, [start]);

  // Leaving the page ends the tour without marking it done.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setTour(null);
  }

  const step = tour?.steps[index];

  const stepKey = tour ? `${tour.id}:${index}` : "";

  // Find this step's element and track its position; skip steps whose element is missing.
  // State changes happen in animation-frame callbacks, after the browser has laid out the page.
  useLayoutEffect(() => {
    if (!tour || !step?.target) return;
    const el = document.querySelector(step.target);
    if (!visible(el)) {
      const skip = requestAnimationFrame(() => {
        if (index < tour.steps.length - 1) setIndex(index + 1);
        else setMeasured({ key: stepKey, rect: null });
      });
      return () => cancelAnimationFrame(skip);
    }
    const behavior: ScrollBehavior = reducedMotion() ? "auto" : "smooth";
    // Phones show the guide as a bottom sheet, so bring the element to the top, just under the header.
    if (window.innerWidth <= 640) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 80, behavior });
    else el.scrollIntoView({ block: "center", behavior });
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        setMeasured({ key: stepKey, rect: { top: r.top, left: r.left, width: r.width, height: r.height } });
      });
    };
    measure();
    const settle = window.setTimeout(measure, 450);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [tour, step, index, stepKey]);

  // Keyboard: Escape skips, arrows move between steps.
  useEffect(() => {
    if (!tour) return;
    card.current?.focus();
    const keys = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (index < tour.steps.length - 1) setIndex(index + 1); else finish(); }
      else if (e.key === "ArrowLeft" && index > 0) { e.preventDefault(); setIndex(index - 1); }
    };
    document.addEventListener("keydown", keys);
    return () => document.removeEventListener("keydown", keys);
  }, [tour, index, finish]);

  if (!tour || !step) return null;
  const ready = !step.target || measured?.key === stepKey;
  const rect = measured?.key === stepKey ? measured.rect : null;
  const last = index === tour.steps.length - 1;
  const pad = 8;
  const spot = rect && step.target ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  // Place the card below the highlight when it fits, otherwise above; phones use a bottom sheet (CSS).
  let cardStyle: React.CSSProperties | undefined;
  if (spot && typeof window !== "undefined" && window.innerWidth > 640) {
    const width = 340, gap = 14;
    const left = Math.min(Math.max(16, spot.left), window.innerWidth - width - 16);
    const below = spot.top + spot.height + gap;
    cardStyle = below + 220 < window.innerHeight
      ? { top: below, left, width }
      : { top: Math.max(16, spot.top - gap - 220), left, width };
  }

  if (!ready) return <div className="tour-root"><div className="tour-dim" aria-hidden /></div>;
  return (
    <div className="tour-root">
      <div className="tour-shield" onClick={finish} aria-hidden />
      {spot ? (
        <>
          {/* Four panels dim everything except the highlighted element. */}
          <div className="tour-veil" style={{ top: 0, left: 0, right: 0, height: Math.max(0, spot.top) }} aria-hidden />
          <div className="tour-veil" style={{ top: spot.top + spot.height, left: 0, right: 0, bottom: 0 }} aria-hidden />
          <div className="tour-veil" style={{ top: spot.top, left: 0, width: Math.max(0, spot.left), height: spot.height }} aria-hidden />
          <div className="tour-veil" style={{ top: spot.top, left: spot.left + spot.width, right: 0, height: spot.height }} aria-hidden />
          <div className="tour-spot" style={spot} aria-hidden />
        </>
      ) : <div className="tour-dim" aria-hidden />}
      <div
        ref={card}
        tabIndex={-1}
        className={`tour-card${spot ? "" : " tour-card-center"}`}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        aria-describedby="tour-body"
      >
        <p className="tour-count">{tour.name} · step {index + 1} of {tour.steps.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p id="tour-body">{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="tour-skip" onClick={finish}>{last ? "Close" : "Skip tour"}</button>
          <div>
            {index > 0 && <button type="button" className="tour-button" onClick={() => setIndex(index - 1)}>Back</button>}
            <button type="button" className="tour-button tour-primary" onClick={() => (last ? finish() : setIndex(index + 1))}>
              {last ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
