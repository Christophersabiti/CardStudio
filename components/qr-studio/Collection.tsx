"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { type QrRecord } from "@/lib/qr-studio/schema";
import { sameContent } from "@/lib/publication";
export default function Collection({
  items,
  metrics,
}: {
  items: QrRecord[];
  metrics: Record<string, { opens: number; clicks: number }>;
}) {
  const router = useRouter(),
    ids = useRef<Record<string, string>>({});
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(""),
    [confirm, setConfirm] = useState("");
  async function action(q: QrRecord, action: string) {
    setBusy(q.id);
    setError("");
    try {
      if (action === "duplicate") ids.current[q.id] ||= crypto.randomUUID();
      const r = await fetch(`/api/qr-codes/${q.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          revision: q.revision,
          ...(action === "duplicate" ? { id: ids.current[q.id] } : {}),
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setConfirm("");
      if (action === "duplicate") router.push(`/qr-studio/${body.record.slug}`);
      else router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      {error && (
        <p role="alert" className="cs-error">
          {error}
        </p>
      )}
      {!items.length ? (
        <div className="qr-empty">
          <h2>Give your next moment a QR.</h2>
          <p className="qr-muted">
            Events, places, images, videos and useful links. All in one scan.
          </p>
          <Link className="cs-button cs-primary" href="/qr-studio">
            Create a QR code ↗
          </Link>
        </div>
      ) : (
        <div className="qr-dashboard-grid">
          {items.map((q) => (
            <article className="qr-item" key={q.id}>
              <p className="qr-eyebrow">{q.data.type}</p>
              <h2>{q.data.title || `Untitled ${q.data.type}`}</h2>
              <p className="qr-muted">
                {q.deleted_at
                  ? "In Trash"
                  : q.archived_at
                    ? "Archived"
                    : q.published
                      ? sameContent(q.data, q.published_data)
                        ? "Published"
                        : "Published · draft changes pending"
                      : "Private draft"}
              </p>
              {metrics[q.id] && (
                <p className="qr-muted">
                  Last 90 days: {metrics[q.id].opens} QR opens ·{" "}
                  {metrics[q.id].clicks} link clicks
                </p>
              )}
              <details>
                <summary>Manage QR</summary>
                <div className="qr-inline">
                  {!q.deleted_at && !q.archived_at && (
                    <>
                      <Link className="cs-button" href={`/qr-studio/${q.slug}`}>
                        Edit
                      </Link>
                      {q.published && (
                        <a
                          className="cs-button"
                          href={`/view/${q.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View ↗
                        </a>
                      )}
                    </>
                  )}
                  {(q.deleted_at
                    ? ["restore"]
                    : q.archived_at
                      ? ["unarchive", "delete"]
                      : [
                          "duplicate",
                          ...(q.published ? ["unpublish"] : []),
                          "archive",
                          "delete",
                        ]
                  ).map((a) => (
                    <button
                      className="cs-button"
                      key={a}
                      disabled={!!busy}
                      onClick={() =>
                        a === "delete" ? setConfirm(q.id) : void action(q, a)
                      }
                    >
                      {
                        (
                          {
                            restore: "Restore as draft",
                            unarchive: "Unarchive as draft",
                            delete: "Move to Trash",
                            archive: "Archive",
                            unpublish: "Unpublish",
                            duplicate: "Duplicate",
                          } as Record<string, string>
                        )[a]
                      }
                    </button>
                  ))}
                </div>
              </details>
              {confirm === q.id && (
                <div>
                  <p>Move to Trash and unpublish? You can restore it later.</p>
                  <div className="qr-inline">
                    <button
                      disabled={!!busy}
                      onClick={() => void action(q, "delete")}
                    >
                      Confirm move
                    </button>
                    <button onClick={() => setConfirm("")}>Cancel</button>
                  </div>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </>
  );
}
