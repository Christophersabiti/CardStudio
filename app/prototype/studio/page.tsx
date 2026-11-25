import type { Metadata } from "next";
import SiteHeader from "@/components/nav/SiteHeader";
import Workspace from "@/components/prototype/Workspace";

// PROTOTYPE ONLY — design review for docs/design-studio-redesign-proposal.md.
// Uses sample data held in the viewer's browser; reads and writes no account data.
export const metadata: Metadata = {
  title: "My designs (prototype) | Card Studio",
  robots: { index: false, follow: false },
};

export default function PrototypeStudioPage() {
  return (
    <div className="pt-app">
      <SiteHeader />
      <Workspace />
    </div>
  );
}
