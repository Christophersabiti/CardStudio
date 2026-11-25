import Link from "next/link";

/** Shown in place of a tool an administrator has switched off. */
export default function FeatureUnavailable({ name }: { name: string }) {
  return (
    <main id="main-content" className="max-w-xl mx-auto px-5 py-16 text-center">
      <h1 className="text-3xl font-bold">{name} is taking a short break</h1>
      <p className="cs-muted mt-4">
        This tool is temporarily unavailable. Anything you have already published still works. Please check back soon.
      </p>
      <div className="flex flex-wrap justify-center gap-3 mt-8">
        <Link href="/create" className="cs-button cs-primary">See what else you can make</Link>
        <Link href="/designs" className="cs-button">My designs</Link>
      </div>
    </main>
  );
}
