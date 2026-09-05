import Link from "next/link";
import type { Brand } from "@/lib/brand";

export default function Header({ brand }: { brand: Brand }) {
  return (
    <header
      className="flex items-center gap-3.5 flex-wrap px-5 py-4 border-b mb-6"
      style={{ background: "var(--surface)", borderColor: "var(--line)" }}
    >
      <Link href="/" className="flex items-center gap-3 min-w-0 no-underline" style={{ color: "var(--ink)" }}>
        {brand.logo ? (
          <span className="bg-white rounded-lg px-2 py-1.5 flex shadow-sm">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={brand.logo} alt={brand.name} className="h-6 w-auto block" />
          </span>
        ) : (
          <span
            className="grid place-items-center rounded-lg text-white font-display font-extrabold text-base w-9 h-9"
            style={{ background: "var(--brand-primary)" }}
          >
            {brand.name[0]}
          </span>
        )}
        <span className="min-w-0">
          <span className="block font-display font-extrabold text-base tracking-tight">Card Studio</span>
          <span className="block text-[11.5px]" style={{ color: "var(--muted)" }}>
            {brand.name} · {brand.tagline}
          </span>
        </span>
      </Link>
      <nav className="ml-auto flex gap-3 text-sm font-semibold" aria-label="Main navigation"><Link href="/">Create</Link><Link href="/dashboard">My cards / Sign in</Link></nav>
    </header>
  );
}
