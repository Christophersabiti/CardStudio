import EmailSignature from "@/components/marketing/EmailSignature";
import Link from "next/link";
import { notFound } from "next/navigation";
import Shell from "@/components/marketing/Shell";
import { featureCopy } from "@/lib/marketing";
export function generateStaticParams() {
  return Object.keys(featureCopy).map((slug) => ({ slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (slug === "email-signatures") return <Shell><EmailSignature /></Shell>;
  const page = featureCopy[slug];
  if (!page) notFound();
  return (
    <Shell>
      <main id="main-content" className="mk-detail">
        <p className="mk-eyebrow">
          {page.planned ? "On the roadmap" : "Explore Card Studio"}
        </p>
        <h1>{page.title}</h1>
        <p className="mk-lead">{page.intro}</p>
        <div className="mk-three">
          {page.points.map((point, i) => (
            <article key={point}>
              <span className="mk-number">0{i + 1}</span>
              <p>{point}</p>
            </article>
          ))}
        </div>
        <Link className="mk-button" href={slug === "qr-sharing" ? "/qr-studio" : "/studio"}>
          Open the studio ↗
        </Link>
        {slug === "contact" && (
          <p className="mk-lead">
            <a href="mailto:sabiti.christopher@gmail.com">Email support ↗</a>
          </p>
        )}
      </main>
    </Shell>
  );
}
