import Link from "next/link";
import Navigation from "./Navigation";
import { navigation } from "@/lib/marketing";
import "./marketing.css";
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk">
      <a className="mk-skip" href="#main-content">
        Skip to content
      </a>
      <Navigation />
      {children}
      <footer className="mk-footer">
        <div>
          <Link className="mk-logo" href="/">
            card studio<span>·</span>
          </Link>
          <p>
            Make the introduction.
            <br />
            Keep the connection.
          </p>
        </div>
        {Object.entries(navigation).map(([label, links]) => (
          <div key={label}>
            <h2>{label}</h2>
            {links.map(([title, , slug]) => (
              <Link key={slug} href={`/explore/${slug}`}>
                {title}
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
