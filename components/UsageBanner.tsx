"use client";
import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { useAccountSummary } from "@/components/nav/useAccountSummary";
export default function UsageBanner() {
  const { user } = useUser();
  const data = useAccountSummary(user?.id ?? null);
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
            {k.startsWith("monthly") && data.reset
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
