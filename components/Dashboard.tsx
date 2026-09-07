/* eslint-disable @next/next/no-img-element */
"use client";
import { ArrowUpRightIcon } from "@/components/icons";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useEffect, useTransition, useCallback } from "react";
import type {
  CardData,
  GroupData,
  RecordKind,
  StudioRecord,
} from "@/lib/types";
import { sameContent } from "@/lib/publication";

export default function Dashboard({
  items,
  total,
  ownerId,
  query,
  trash,
  page,
  initialView,
}: {
  items: (StudioRecord & { kind: RecordKind })[];
  total: number;
  ownerId: string;
  query: string;
  trash: boolean;
  page: number;
  initialView?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [view, setView] = useState(
    initialView === "list" ? "list" : "thumbnails",
  );
  const [search, setSearch] = useState(query);
  const [pending, startTransition] = useTransition();
  const url = useCallback(
    (q = query, t = trash, p = 1, v = view) => {
      const s = new URLSearchParams({
        q,
        trash: t ? "1" : "0",
        page: String(p),
        view: v,
      });
      return "/dashboard?" + s;
    },
    [query, trash, view],
  );
  useEffect(() => {
    if (!initialView) {
      const saved = localStorage.getItem(`card-studio-view:${ownerId}`);
      if (saved === "list") startTransition(() => setView("list"));
    }
  }, [initialView, ownerId]);
  useEffect(() => {
    if (search === query) return;
    const timer = setTimeout(() => {
      if (search.trim().length === 1) return;
      startTransition(() => router.replace(url(search.trim())));
    }, 250);
    return () => clearTimeout(timer);
  }, [search, query, trash, view, router, url]); // URL changes retain the view and filters.
  useEffect(() => {
    startTransition(() => setSearch(query));
  }, [query]);
  function changeView(next: string) {
    setView(next);
    localStorage.setItem(`card-studio-view:${ownerId}`, next);
    router.replace(url(query, trash, page, next));
  }

  const duplicateIds = useRef<Record<string, string>>({});
  const visible = items;
  async function action(
    record: StudioRecord & { kind: RecordKind },
    action: "duplicate" | "unpublish" | "delete" | "restore",
  ) {
    setBusy(record.id);
    setError("");
    setMessage("");
    try {
      if (action === "duplicate")
        duplicateIds.current[record.id] ||= crypto.randomUUID();
      const res = await fetch(`/api/${record.kind}/${record.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          revision: record.revision,
          ...(action === "duplicate"
            ? { id: duplicateIds.current[record.id] }
            : {}),
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      setConfirm("");
      if (action === "duplicate")
        router.push(`/edit/${record.kind}/${result.record.slug}`);
      else {
        window.dispatchEvent(new Event("card-studio-usage"));
        setMessage(
          action === "delete"
            ? "Moved to Trash and unpublished. You can restore it here."
            : action === "restore"
              ? "Restored as a private draft. Publish it when you're ready."
              : "Unpublished. The public link no longer shows this card.",
        );
        router.refresh();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update this card.");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="flex flex-wrap gap-3 my-6 items-center">
        <div role="group" aria-label="Card collection">
          <button
            aria-pressed={!trash}
            className="cs-button"
            onClick={() => router.push(url(query, false))}
          >
            My cards
          </button>
          <button
            aria-pressed={trash}
            className="cs-button"
            onClick={() => router.push(url(query, true))}
          >
            Trash
          </button>
        </div>
        <label className="flex-1 min-w-[180px]">
          <span className="sr-only">Search cards by keyword</span>
          <input
            className="cs-input w-full"
            type="search"
            value={search}
            maxLength={120}
            placeholder="Search names, company, email…"
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div role="group" aria-label="Card view">
          {["thumbnails", "list"].map((v) => (
            <button
              key={v}
              className="cs-button"
              aria-pressed={view === v}
              onClick={() => changeView(v)}
            >
              {v === "list" ? "List" : "Thumbnails"}
            </button>
          ))}
        </div>
      </div>
      <p role="status" className="text-sm cs-muted mb-4">
        {pending
          ? "Searching…"
          : search.trim().length === 1
            ? "Enter at least two characters to search."
            : `${total} ${total === 1 ? "result" : "results"}`}
      </p>
      {error && (
        <p role="alert" className="cs-error mb-4">
          {error}{error.includes("plan limit")&&<Link href="/pricing" className="cs-button ml-3">Upgrade plan</Link>}
        </p>
      )}
      {message && (
        <p role="status" className="cs-panel text-sm mb-4">
          {message}
        </p>
      )}
      {visible.length === 0 ? (
        <div className="cs-panel">
          <h2 className="text-lg font-bold">
            {query
              ? "No matching cards"
              : trash
                ? "Trash is empty"
                : "Your next introduction starts here"}
          </h2>
          <p className="cs-muted mt-2">
            {trash
              ? "Deleted cards remain recoverable here."
              : "Create a card, save it privately, then publish when you're ready."}
          </p>
          {!trash && (
            <Link
              href="/studio"
              className="cs-button cs-primary inline-block mt-4"
            >
              Create a card
            </Link>
          )}
        </div>
      ) : (
        <div
          className={
            view === "list"
              ? "grid gap-3"
              : "grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
          }
        >
          {visible.map((record) => {
            const title =
              record.kind === "groups"
                ? (record.data as GroupData).name
                : [
                    (record.data as CardData).firstName,
                    (record.data as CardData).lastName,
                  ]
                    .filter(Boolean)
                    .join(" ") || (record.data as CardData).organization;
            return (
              <article
                key={record.id}
                className={`cs-panel flex flex-col gap-3 ${view === "thumbnails" ? "cs-thumbnail" : ""}`}
              >
                {view === "thumbnails" && (
                  <div className="cs-thumbnail-cover">
                    {record.kind === "cards" &&
                    (record.data as CardData).photo ? (
                      <img
                        src={(record.data as CardData).photo}
                        alt=""
                        className="cs-thumbnail-photo"
                      />
                    ) : (
                      <span className="cs-thumbnail-photo">
                        {title.slice(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                )}
                <span className="cs-muted text-xs uppercase tracking-wide">
                  {record.kind === "cards"
                    ? "Individual card"
                    : "Group contacts"}
                </span>
                <h2 className="text-xl font-bold break-words">{title}</h2>
                {record.kind === "cards" && (
                  <p className="text-sm cs-muted">
                    {(record.data as CardData).title}
                    <br />
                    {(record.data as CardData).organization} ·{" "}
                    {(record.data as CardData).location}
                    <br />
                    {(record.data as CardData).orientation || "landscape"}
                  </p>
                )}
                <p className="text-sm cs-muted">
                  {record.deleted_at
                    ? "In Trash"
                    : record.published
                      ? sameContent(record.data, record.published_data)
                        ? "Published"
                        : "Published · draft changes pending"
                      : "Private draft"}
                </p>
                <details className="mt-auto">
                  <summary className="cs-button cursor-pointer">
                    Card actions ···
                  </summary>
                  <div className="flex flex-wrap gap-2 mt-3">
                    {trash ? (
                      <button
                        className="cs-button"
                        disabled={!!busy}
                        onClick={() => action(record, "restore")}
                      >
                        Restore as draft
                      </button>
                    ) : (
                      <>
                        <Link
                          className="cs-button cs-primary"
                          href={`/edit/${record.kind}/${record.slug}`}
                        >
                          Edit card
                        </Link>
                        {record.published && (
                          <a
                            className="cs-button"
                            href={`/${record.kind === "cards" ? "c" : "g"}/${record.slug}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View public card <ArrowUpRightIcon />
                          </a>
                        )}
                        <button
                          className="cs-button"
                          disabled={!!busy}
                          onClick={() => action(record, "duplicate")}
                        >
                          Duplicate
                        </button>
                        {record.published && (
                          <button
                            className="cs-button"
                            disabled={!!busy}
                            onClick={() => action(record, "unpublish")}
                          >
                            Unpublish
                          </button>
                        )}
                        <button
                          className="cs-button"
                          disabled={!!busy}
                          onClick={() => setConfirm(record.id)}
                        >
                          Move to Trash
                        </button>
                      </>
                    )}
                  </div>
                </details>
                {confirm === record.id && (
                  <div className="rounded-lg border p-3 flex flex-col gap-2">
                    <p className="text-sm">
                      Move this card to Trash? Its public link will stop
                      working. Downloaded files cannot be recalled.
                    </p>
                    <div className="flex gap-2">
                      <button
                        className="cs-button"
                        disabled={!!busy}
                        onClick={() => action(record, "delete")}
                      >
                        Confirm move
                      </button>
                      <button
                        className="cs-button"
                        onClick={() => setConfirm("")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                {busy === record.id && (
                  <p role="status" className="text-sm">
                    Updating…
                  </p>
                )}
              </article>
            );
          })}
        </div>
      )}
      <nav aria-label="Pagination" className="flex gap-4 mt-6">
        {page > 1 && (
          <Link className="cs-button" href={url(query, trash, page - 1)}>
            Previous page
          </Link>
        )}
        {total > page * 24 && (
          <Link className="cs-button" href={url(query, trash, page + 1)}>
            Next page
          </Link>
        )}
      </nav>
    </>
  );
}
