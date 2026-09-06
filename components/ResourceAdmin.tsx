"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Resource = {
  id: string;
  slug: string;
  kind: string;
  owner_id: string;
  published: boolean;
  deleted_at: string | null;
};
export default function ResourceAdmin({
  resources,
}: {
  resources: Resource[];
}) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const router = useRouter();
  return (
    <section className="mt-10" id="resources">
      <h2 className="text-2xl mb-4">Cards & groups across all accounts</h2>
      <p className="cs-muted mb-4">
        Moderation is recorded with a reason. Restore returns a card to a
        private draft and respects the owner’s current quota.
      </p>
      <p role="status">{message}</p>
      <div className="grid gap-3">
        {resources.map((r) => (
          <form
            key={r.id}
            className="cs-panel flex flex-wrap items-end gap-3"
            onSubmit={async (e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              setBusy(true);
              setMessage("");
              try {
                const res = await fetch("/api/admin/resources", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    kind: r.kind,
                    id: r.id,
                    action: f.get("action"),
                    reason: f.get("reason"),
                  }),
                });
                const b = await res.json();
                if (!res.ok) throw Error(b.error);
                setMessage("Resource updated and audit recorded.");
                router.refresh();
              } catch (e) {
                setMessage(e instanceof Error ? e.message : "Update failed.");
              } finally {
                setBusy(false);
              }
            }}
          >
            <div className="flex-1 min-w-0">
              <strong>
                {r.kind} / {r.slug}
              </strong>
              <p className="text-xs cs-muted break-all">Owner: {r.owner_id}</p>
              <p className="text-sm">
                {r.deleted_at
                  ? "Trash"
                  : r.published
                    ? "Published"
                    : "Private draft"}
              </p>
            </div>
            <label className="grid text-sm gap-1">
              Action
              <select className="cs-input" name="action">
                {r.deleted_at ? (
                  <option value="restore">Restore privately</option>
                ) : (
                  <>
                    <option value="unpublish">Unpublish</option>
                    <option value="trash">Move to Trash</option>
                  </>
                )}
              </select>
            </label>
            <label className="grid text-sm gap-1">
              Reason
              <input
                className="cs-input"
                name="reason"
                minLength={5}
                maxLength={300}
                required
              />
            </label>
            <button disabled={busy} className="cs-button">
              Apply
            </button>
          </form>
        ))}
      </div>
    </section>
  );
}
