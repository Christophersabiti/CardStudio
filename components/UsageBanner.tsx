"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
type Usage = {
  name: string;
  unlimited?: boolean;
  free: boolean;
  upgrade: boolean;
  nearing: string[];
  usage: Record<string, number>;
  limits: Record<string, number>;
  reset: string;
};
export default function UsageBanner() {
  const [data, setData] = useState<Usage | null>(null);
  useEffect(() => {
    let active = true;
    const load = () =>
      void fetch("/api/usage", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((v) => {
          if (active) setData(v);
        })
        .catch(() => {});
    load();
    window.addEventListener("card-studio-usage", load);
    window.addEventListener("focus", load);

    return () => {
      active = false;
      window.removeEventListener("card-studio-usage", load);
      window.removeEventListener("focus", load);
    };
  }, []);
  if (!data?.name) return null;
  if (data.unlimited)
    return (
      <aside className="cs-panel my-5 flex flex-wrap justify-between items-center gap-4">
        <div>
          <p className="font-bold">Superadmin · Unlimited access</p>
          <p className="text-sm cs-muted mt-1">
            No card, storage or creation quotas. No billing plan required.
          </p>
        </div>
        <Link className="cs-button" href="/admin">
          Control center
        </Link>
      </aside>
    );
  return (
    <aside className="cs-panel my-5 flex flex-wrap gap-4 items-center justify-between">
      <div>
        <p className="font-bold">
          {data.name} · {data.usage.active_cards || 0} /{" "}
          {data.limits.active_cards} active cards
        </p>
        {data.nearing.map((k) => (
          <p key={k} className="text-sm mt-1">
            {k.replaceAll("_", " ")}: {data.usage[k] || 0} / {data.limits[k]}
            {k.startsWith("monthly")
              ? ` · resets ${new Date(data.reset).toLocaleDateString("en-GB")}`
              : ""}
          </p>
        ))}
      </div>
      <Link
        href={data.upgrade ? "/pricing" : "/billing"}
        className={`cs-button ${data.upgrade ? "cs-primary" : ""}`}
      >
        {data.upgrade ? "Upgrade" : "View usage & billing"}
      </Link>
    </aside>
  );
}
