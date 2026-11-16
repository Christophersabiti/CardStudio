import Link from "next/link";
import Navigation from "./Navigation";
import { featureHref, navigation } from "@/lib/marketing";
import { isClerkConfigured } from "@/lib/auth/config";
import "./marketing.css";
export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mk">
      <a className="mk-skip" href="#main-content">
        Skip to content
      </a>
      <Navigation authEnabled={isClerkConfigured()} />
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
        {Object.entries(navigation).map(([label, links]) => (
          <div key={label}>
            <h2>{label}</h2>
            {links.map(([title, , slug]) => (
              <Link key={slug} href={featureHref(slug)}>
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
