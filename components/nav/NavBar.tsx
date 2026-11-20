"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SignOutButton, UserButton, useUser } from "@clerk/nextjs";
import { helpLinks, isActive, products, workLinks } from "@/lib/navigation";
import { ArrowUpRightIcon, ChevronDownIcon, CloseIcon, FolderIcon, HomeIcon, MenuIcon, PlusIcon, UserIcon } from "@/components/icons";
import ProductIcon from "./ProductIcon";

type BrandInfo = { key: string; name: string; logo: string; initial: string };
type Menu = "create" | "work" | "help" | null;

export default function NavBar({ authEnabled, brand }: { authEnabled: boolean; brand: BrandInfo }) {
  return authEnabled ? <ClerkNav brand={brand} /> : <Nav brand={brand} signedIn={false} />;
}

/** Reads Clerk state; only rendered inside ClerkProvider. */
function ClerkNav({ brand }: { brand: BrandInfo }) {
  const { isLoaded, isSignedIn } = useUser();
  return <Nav brand={brand} signedIn={!!isSignedIn} loading={!isLoaded} clerk />;
}

function Nav({ brand, signedIn, loading = false, clerk = false }: { brand: BrandInfo; signedIn: boolean; loading?: boolean; clerk?: boolean }) {
  const pathname = usePathname() || "/";
  const [menu, setMenu] = useState<Menu>(null);
  const [sheet, setSheet] = useState(false);
  const root = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);

  // Close everything after navigating to another page.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenu(null);
    setSheet(false);
  }

  useEffect(() => {
    const outside = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setMenu(null);
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (menu) root.current?.querySelector<HTMLButtonElement>(`[data-menu="${menu}"]`)?.focus();
      if (sheet) menuButton.current?.focus();
      setMenu(null);
      setSheet(false);
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [menu, sheet]);

  // Lock page scroll and keep keyboard focus inside the open mobile menu.
  useEffect(() => {
    if (!sheet) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const panel = sheetRef.current;
    panel?.querySelector<HTMLElement>("a,button")?.focus();
    const trap = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !panel) return;
      const items = [...panel.querySelectorAll<HTMLElement>("a[href],button:not([disabled])")];
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
    };
    document.addEventListener("keydown", trap);
    return () => {
      document.body.style.overflow = previous;
      document.removeEventListener("keydown", trap);
    };
  }, [sheet]);

  const toggle = (name: Exclude<Menu, null>) => setMenu((m) => (m === name ? null : name));
  const workActive = workLinks.some((l) => isActive(pathname, l.href));

  return (
    <>
      <header ref={root} className="sn-header">
        <div className="sn-bar">
          <Logo brand={brand} />

          <nav className="sn-desktop" aria-label="Main navigation">
            <MenuButton name="create" label="Create" open={menu} onToggle={toggle} />
            {signedIn && (
              <div className="sn-group">
                <MenuButton name="work" label="My work" open={menu} onToggle={toggle} active={workActive} />
                {menu === "work" && (
                  <div className="sn-panel sn-panel-list" id="menu-work">
                    <p className="sn-eyebrow">Your work</p>
                    <LinkList links={workLinks} pathname={pathname} />
                  </div>
                )}
              </div>
            )}
            <Link href="/pricing" className="sn-link" aria-current={isActive(pathname, "/pricing") ? "page" : undefined}>Pricing</Link>
            <div className="sn-group">
              <MenuButton name="help" label="Help" open={menu} onToggle={toggle} />
              {menu === "help" && (
                <div className="sn-panel sn-panel-list" id="menu-help">
                  <p className="sn-eyebrow">Help</p>
                  <LinkList links={helpLinks} pathname={pathname} />
                </div>
              )}
            </div>
          </nav>

          <div className="sn-actions">
            {loading ? (
              <Link href="/dashboard" className="sn-link">Account</Link>
            ) : signedIn ? (
              <UserButton userProfileMode="navigation" userProfileUrl="/dashboard/account" />
            ) : (
              <>
                <Link href="/sign-in" className="sn-link sn-signin">Sign in</Link>
                <Link href="/studio" className="sn-cta">Start free</Link>
              </>
            )}
            <button
              ref={menuButton}
              className="sn-burger"
              aria-expanded={sheet}
              aria-controls="site-menu"
              aria-label={sheet ? "Close menu" : "Open menu"}
              onClick={() => { setMenu(null); setSheet((s) => !s); }}
            >
              {sheet ? <CloseIcon width="24" height="24" /> : <MenuIcon width="24" height="24" />}
            </button>
          </div>
        </div>

        {menu === "create" && (
          <div className="sn-panel sn-panel-create" id="menu-create">
            <div className="sn-panel-head">
              <p className="sn-eyebrow">What do you want to make?</p>
              <Link href="/create" className="sn-more">See everything you can make <ArrowUpRightIcon /></Link>
            </div>
            <ProductGrid pathname={pathname} />
          </div>
        )}
      </header>

      {sheet && (
        <div className="sn-sheet" id="site-menu" ref={sheetRef} role="dialog" aria-modal="true" aria-label="Site menu">
          <section>
            <h2 className="sn-eyebrow">Create</h2>
            <ProductGrid pathname={pathname} compact />
          </section>
          {signedIn && (
            <section>
              <h2 className="sn-eyebrow">My work</h2>
              <LinkList links={workLinks} pathname={pathname} />
            </section>
          )}
          <section>
            <h2 className="sn-eyebrow">Help</h2>
            <LinkList links={[{ title: "Pricing", href: "/pricing", summary: "Free, Basic and Premium plans." }, ...helpLinks]} pathname={pathname} />
          </section>
          <section className="sn-sheet-account">
            {signedIn ? (
              <>
                <Link href="/dashboard/account" className="sn-sheet-button">Account settings</Link>
                {clerk && <SignOutButton redirectUrl="/sign-in"><button className="sn-sheet-button sn-ghost">Sign out</button></SignOutButton>}
              </>
            ) : (
              <>
                <Link href="/studio" className="sn-sheet-button sn-solid">Start free</Link>
                <Link href="/sign-in" className="sn-sheet-button">Sign in</Link>
              </>
            )}
          </section>
        </div>
      )}

      {signedIn && <BottomTabs pathname={pathname} />}
    </>
  );
}

function Logo({ brand }: { brand: BrandInfo }) {
  return (
    <Link href="/" className="sn-logo" aria-label="Card Studio home">
      {brand.key === "neutral" || !brand.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/brand/icon-192.png" alt="" width={34} height={34} />
      ) : (
        <span className="sn-brand-logo">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.logo} alt={brand.name} />
        </span>
      )}
      <span>Card Studio</span>
    </Link>
  );
}

function MenuButton({ name, label, open, onToggle, active = false }: { name: Exclude<Menu, null>; label: string; open: Menu; onToggle: (n: Exclude<Menu, null>) => void; active?: boolean }) {
  return (
    <button
      type="button"
      className={`sn-link sn-menu-button${active ? " is-active" : ""}`}
      data-menu={name}
      aria-expanded={open === name}
      aria-controls={`menu-${name}`}
      onClick={() => onToggle(name)}
    >
      {label}
      <ChevronDownIcon width="16" height="16" className={open === name ? "sn-turned" : undefined} />
    </button>
  );
}

/** Products sharing a page (card and team contacts both open /studio) are never marked current. */
const ownsPath = (href: string) => products.filter((p) => p.href.split("?")[0] === href.split("?")[0]).length === 1;

function ProductGrid({ pathname, compact = false }: { pathname: string; compact?: boolean }) {
  return (
    <ul className={`sn-products${compact ? " sn-compact" : ""}`}>
      {products.map((p) => (
        <li key={p.key}>
          <Link href={p.href} className="sn-product" aria-current={ownsPath(p.href) && isActive(pathname, p.href) ? "page" : undefined}>
            <ProductIcon product={p.key} />
            <span className="sn-product-text">
              <strong>{p.title}</strong>
              <small>{p.summary}</small>
              {p.needsAccount && !compact && <em>Free account needed</em>}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function LinkList({ links, pathname }: { links: { title: string; href: string; summary?: string }[]; pathname: string }) {
  return (
    <ul className="sn-list">
      {links.map((l) => (
        <li key={l.href}>
          <Link href={l.href} aria-current={isActive(pathname, l.href) ? "page" : undefined}>
            <strong>{l.title}</strong>
            {l.summary && <small>{l.summary}</small>}
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Phone-only quick navigation for signed-in people. */
function BottomTabs({ pathname }: { pathname: string }) {
  const tabs = [
    { href: "/dashboard", label: "Home", icon: HomeIcon, match: (p: string) => p === "/dashboard" },
    { href: "/create", label: "Create", icon: PlusIcon, match: (p: string) => p === "/create" || ["/studio", "/qr-studio", "/stamp-maker", "/email-signature"].some((h) => isActive(p, h)) },
    { href: "/dashboard/qr", label: "QR codes", icon: FolderIcon, match: (p: string) => isActive(p, "/dashboard/qr") },
    { href: "/dashboard/account", label: "Account", icon: UserIcon, match: (p: string) => isActive(p, "/dashboard/account") || isActive(p, "/billing") },
  ];
  return (
    <nav className="sn-tabs" aria-label="Quick navigation">
      {tabs.map(({ href, label, icon: Icon, match }) => (
        <Link key={href} href={href} aria-current={match(pathname) ? "page" : undefined}>
          <Icon width="22" height="22" />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}

