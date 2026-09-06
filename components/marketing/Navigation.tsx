"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { navigation } from "@/lib/marketing";
export default function Navigation() {
  const [open, setOpen] = useState<string | null>(null),
    [mobile, setMobile] = useState(false);
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) {
        setOpen(null);
        setMobile(false);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);
  return (
    <header
      ref={root}
      className="mk-header"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setOpen(null);
          setMobile(false);
          (
            root.current?.querySelector(
              `[data-nav="${open}"]`,
            ) as HTMLButtonElement
          )?.focus();
        }
      }}
    >
      <Link className="mk-logo" href="/" aria-label="Card Studio home">
        <span>
          c<span>·</span>
        </span>
        card studio
      </Link>
      <button
        className="mk-menu"
        aria-expanded={mobile}
        aria-controls="public-navigation"
        onClick={() => setMobile(!mobile)}
      >
        {mobile ? "Close" : "Menu"} <span aria-hidden>☰</span>
      </button>
      <nav
        id="public-navigation"
        className={`mk-nav ${mobile ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        {Object.entries(navigation).map(([label, links]) => (
          <div className="mk-nav-group" key={label}>
            <button
              data-nav={label}
              aria-expanded={open === label}
              aria-controls={`nav-${label}`}
              onClick={() => setOpen(open === label ? null : label)}
            >
              {label}
              <span className={open === label ? "turned" : ""} aria-hidden>
                ⌄
              </span>
            </button>
            <div
              className="mk-dropdown"
              id={`nav-${label}`}
              hidden={open !== label}
            >
              <p className="mk-eyebrow">Explore {label.toLowerCase()}</p>
              {links.map(([title, description, slug]) => (
                <Link
                  href={`/explore/${slug}`}
                  key={slug}
                  onClick={() => {
                    setOpen(null);
                    setMobile(false);
                  }}
                >
                  <strong>
                    {title}
                    <span aria-hidden>↗</span>
                  </strong>
                  <small>{description}</small>
                </Link>
              ))}
            </div>
          </div>
        ))}
        <Link href="/pricing">Pricing</Link>
        <div className="mk-nav-actions">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/studio" className="mk-button">
            Create your card <span aria-hidden>↗</span>
          </Link>
        </div>
      </nav>
    </header>
  );
}
