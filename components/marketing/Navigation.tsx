"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { navigation } from "@/lib/marketing";
export default function Navigation() {
  const pathname = usePathname();
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
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOpen(null); }}
      onMouseLeave={() => { if (!root.current?.contains(document.activeElement)) setOpen(null); }}
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
          <div className="mk-nav-group" key={label} onMouseEnter={() => { if (window.matchMedia("(hover: hover)").matches) setOpen(label); }}>
            <button
              data-nav={label}
              aria-expanded={open === label}
              aria-controls={`nav-${label}`}
              onClick={(e) => setOpen(e.detail > 0 && window.matchMedia("(hover: hover)").matches ? label : open === label ? null : label)}
            >
              {label}
              <span className={open === label ? "turned" : ""} aria-hidden>
                ⌄
              </span>
            </button>
            <div
              className={`mk-dropdown ${label === "Products" ? "mk-product-dropdown" : ""}`}
              id={`nav-${label}`}
              hidden={open !== label}
            >
              <p className="mk-eyebrow">Explore {label.toLowerCase()}</p>
              {links.map(([title, description, slug]) => (
                <Link
                  href={`/explore/${slug}`}
                  key={slug}
                  data-product={slug}
                  aria-current={pathname === `/explore/${slug}` || (slug === "email-signatures" && pathname === "/email-signature") ? "page" : undefined}
                  onClick={() => {
                    setOpen(null);
                    setMobile(false);
                  }}
                >
                  {label === "Products" && <span className="mk-product-icon" aria-hidden>{slug === "email-signatures" ? "✉" : slug === "digital-cards" ? "▣" : slug === "group-contacts" ? "♧" : "▦"}</span>}
                  <strong>
                    {title}
                    <span aria-hidden>↗</span>
                  </strong>
                  <small>{description}</small>
                  {label === "Products" && <span className="mk-product-art" aria-hidden><span className="mk-mini-card"><i/><b/><b/><b/>{slug === "email-signatures" ? <em>Alex Morgan<br/>Creative Director</em> : <em>card studio ·</em>}</span><span className="mk-mini-badge">{slug === "email-signatures" ? "M　O　✉" : slug === "lead-capture" ? "Coming soon" : "Connect ↗"}</span></span>}
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
