import Link from "next/link";
import SiteHeader from "@/components/nav/SiteHeader";
import { companyLinks, helpLinks, products } from "@/lib/navigation";
import "./marketing.css";

export default function Shell({ children }: { children: React.ReactNode }) {
  const columns = [
    { title: "Create", links: products.map((p) => ({ title: p.title, href: p.href })) },
    { title: "Help", links: helpLinks },
    { title: "Card Studio", links: companyLinks },
  ];
  return (
    <div className="mk">
      <a className="mk-skip" href="#main-content">
        Skip to content
      </a>
      <SiteHeader />
      {children}
      <footer className="mk-footer">
        <div>
          <Link className="mk-logo" href="/">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-192.png" alt="" width={37} height={37} style={{ borderRadius: 10 }} />
            card studio
          </Link>
          <p>
            Make the introduction.
            <br />
            Keep the connection.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h2>{column.title}</h2>
            {column.links.map((link) => (
              <Link key={link.href} href={link.href}>
                {link.title}
              </Link>
            ))}
          </div>
        ))}
        <div className="mk-footer-bottom">
          <span>© {new Date().getFullYear()} Card Studio</span>
          <Link href="/pricing">Plans & pricing</Link>
          <Link href="/billing">Billing</Link>
          <Link href="/dashboard">My dashboard</Link>
        </div>
      </footer>
    </div>
  );
}
