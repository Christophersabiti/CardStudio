import { ArrowUpRightIcon } from "@/components/icons";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import Shell from "@/components/marketing/Shell";
import { featureCopy, featureHref } from "@/lib/marketing";
export function generateStaticParams() {
  return Object.keys(featureCopy).filter((slug) => featureHref(slug) === `/explore/${slug}`).map((slug) => ({ slug }));
}
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (featureHref(slug) !== `/explore/${slug}`) redirect(featureHref(slug));
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
          Open the studio <ArrowUpRightIcon />
        </Link>
        {slug === "contact" && (
          <p className="mk-lead">
            <a href="mailto:sabiti.christopher@gmail.com">Email support <ArrowUpRightIcon /></a>
          </p>
        )}
      </main>
    </Shell>
  );
}
