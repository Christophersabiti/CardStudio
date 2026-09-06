import "./globals.css";
import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { activeBrand, brandCssVars } from "@/lib/brand";
import { ClerkProvider } from "@clerk/nextjs";
import { isClerkConfigured } from "@/lib/auth/config";

export const metadata: Metadata = {
  title: `${activeBrand.name} · Card Studio`,
  description: activeBrand.tagline,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&display=swap"
        />
      </head>
      <body style={brandCssVars(activeBrand) as CSSProperties}>
        {isClerkConfigured() ? <ClerkProvider signInUrl="/sign-in" signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/dashboard" signUpFallbackRedirectUrl="/dashboard"
          afterSignOutUrl="/sign-in">{children}</ClerkProvider> : children}
      </body>
    </html>
  );
}
