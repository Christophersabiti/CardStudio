/* eslint-disable @next/next/no-img-element */
"use client";
import { ArrowUpRightIcon } from "@/components/icons";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, startTransition } from "react";
import {
  emptyQr,
  qrDraftSchema,
  qrTypes,
  localToUtc,
  utcToLocal,
  type QrData,
  type QrRecord,
} from "@/lib/qr-studio/schema";
import { sameContent } from "@/lib/publication";
import Experience from "./Experience";
import Upload from "./Upload";
import LiveQr from "./LiveQr";
export default function Builder({
  initial,
  ownerId,
  features,
}: {
  initial?: QrRecord;
  ownerId: string;
  features: {
    logo: boolean;
    colors: boolean;
    svg: boolean;
    analytics: boolean;
  };
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(0);
  const onUploadBusy = (active: boolean) =>
    setUploading((n) => Math.max(0, n + (active ? 1 : -1)));
  const [data, setData] = useState<QrData>(initial?.data || emptyQr()),
    [record, setRecord] = useState(initial),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [step, setStep] = useState("Content"),
    [ready, setReady] = useState(false),
    [previewError, setPreviewError] = useState(false);
  const id = useRef(initial?.id || ""),
    key = `qr-studio:${ownerId}:${initial?.slug || "new"}`;
  useEffect(() => {
    startTransition(() => {
      try {
        const saved = localStorage.getItem(key);
        if (saved && !initial) {
          const parsed = qrDraftSchema.safeParse(JSON.parse(saved));
          if (parsed.success) {
            setData(parsed.data);
            setMessage("Recovered your local draft.");
          }
        }
      } catch {}
      setReady(true);
    });
  }, [key, initial]);
  useEffect(() => {
    if (ready)
      try {
        localStorage.setItem(key, JSON.stringify(data));
      } catch {}
  }, [data, key, ready]);
  const changed = !record || !sameContent(data, record.published_data);
  const unsaved = !record || !sameContent(data, record.data);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (unsaved) {
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);
  function patch(values: Record<string, unknown>) {
    setData((d) => ({ ...d, ...values }) as QrData);
  }
  async function save(action: "save" | "publish") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      id.current ||= crypto.randomUUID();
      const r = await fetch(`/api/qr-codes${record ? "/" + record.slug : ""}`, {
        method: record ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: id.current,
          revision: record?.revision,
          action,
          data,
        }),
      });
      const body = await r.json();
      if (!r.ok) throw Error(body.error);
      setRecord(body.record);
      if (!record) {
        try {
          localStorage.removeItem(key);
        } catch {}
        router.replace(`/qr-studio/${body.record.slug}`);
      }
      setPreviewError(false);
      setMessage(
        action === "publish"
          ? "Published. The same QR now opens these details."
          : "Private draft saved. Your published page has not changed.",
      );
      window.dispatchEvent(new Event("card-studio-usage"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  }
  const field = (label: string, key: string, value: string, type = "text") => (
    <label className="qr-field">
      {label}
      <input
        type={type}
        value={value}
        maxLength={key === "title" ? 200 : 2000}
        onChange={(e) => patch({ [key]: e.target.value })}
      />
    </label>
  );
  const place = data.type === "event" || data.type === "location" ? data : null;
  return (
    <div className="qr-workspace">
      <div className="qr-studio-heading">
        <div>
          <p className="qr-eyebrow">Card Studio / QR Studio</p>
          <h1>
            One scan.
            <br />
            Everything they need.
          </h1>
          <p className="qr-muted">
            Bring your event, place or media into the moment.
          </p>
        </div>
        <Link href="/dashboard/qr" className="cs-button">
          My QR codes <ArrowUpRightIcon />
        </Link>
      </div>
      <nav className="qr-tabs" aria-label="Editor sections">
        {["Content", "QR design", "Preview"].map((s) => (
          <button key={s} aria-pressed={s === step} onClick={() => setStep(s)}>
            {s}
          </button>
        ))}
      </nav>
      <div className="qr-builder-grid">
        <fieldset className="qr-editor" disabled={busy}>
          {step === "Content" && (
            <>
              <div className="qr-type-grid">
                {qrTypes.map((t) => (
                  <button
                    key={t}
                    disabled={busy || uploading > 0}
                    aria-pressed={data.type === t}
                    onClick={() => {
                      if (data.type !== t) {
                        const next = emptyQr(t);
                        setData({
                          ...next,
                          title: data.title,
                          description: data.description,
                          caption: next.caption,
                          logo: data.logo,
                          cover: data.cover,
                          color: data.color,
                          links: data.links,
                          media: data.media,
                        });
                      }
                    }}
                  >
                    {t === "url" ? "Website" : t[0].toUpperCase() + t.slice(1)}
                  </button>
                ))}
              </div>
              {field("Title", "title", data.title)}
              <label className="qr-field">
                Description
                <textarea
                  value={data.description}
                  maxLength={2000}
                  rows={3}
                  onChange={(e) => patch({ description: e.target.value })}
                />
              </label>
              {data.type === "event" && (
                <>
                  <label className="qr-field">
                    Timezone
                    <select
                      value={data.timezone}
                      onChange={(e) => patch({ timezone: e.target.value })}
                    >
                      {Array.from(
                        new Set([
                          data.timezone,
                          "UTC",
                          ...Intl.supportedValuesOf("timeZone"),
                        ]),
                      ).map((z) => (
                        <option key={z}>{z}</option>
                      ))}
                    </select>
                  </label>
                  <p className="qr-muted">
                    Times are displayed in this timezone. Changing it preserves
                    the event’s instant.
                  </p>
                  <div className="qr-two">
                    {(["start", "end"] as const).map((k) => (
                      <label className="qr-field" key={k}>
                        {k === "start" ? "Starts" : "Ends"}
                        <input
                          type="datetime-local"
                          value={utcToLocal(data[k], data.timezone)}
                          onChange={(e) => {
                            try {
                              patch({
                                [k]: localToUtc(e.target.value, data.timezone),
                              });
                              setError("");
                            } catch (err) {
                              setError((err as Error).message);
                            }
                          }}
                        />
                      </label>
                    ))}
                  </div>
                  <label className="qr-field">
                    Event status
                    <select
                      value={data.status}
                      onChange={(e) => patch({ status: e.target.value })}
                    >
                      <option value="scheduled">Scheduled</option>
                      <option value="cancelled">Cancelled</option>
                    </select>
                  </label>
                </>
              )}
              {place && (
                <>
                  <h2>The location</h2>
                  {field("Venue / place name", "venue", place.venue)}
                  {field("Address", "address", place.address)}
                  {field(
                    "Directions link (optional)",
                    "directions",
                    place.directions,
                    "url",
                  )}
                  {field("Opening hours / arrival notes", "hours", place.hours)}
                  {field("Phone (optional)", "phone", place.phone, "tel")}
                </>
              )}
              {data.type === "url" &&
                field("Website URL", "url", data.url, "url")}
              {(data.type === "image" || data.type === "video") && (
                <>
                  <h2>{data.type === "image" ? "Your image" : "Your video"}</h2>
                  {field("File or video page URL", "source", data.source)}
                  <Upload
                    onBusy={onUploadBusy}
                    kind={data.type}
                    onComplete={(source) => patch({ source })}
                  />
                  {field("Image description / video title", "alt", data.alt)}
                </>
              )}
              <h2>Cover image</h2>
              <Upload
                onBusy={onUploadBusy}
                kind="image"
                label="Upload cover"
                onComplete={(cover) => patch({ cover })}
              />
              {data.cover && (
                <button onClick={() => patch({ cover: "" })}>
                  Remove cover
                </button>
              )}
              <h2>Links people can tap</h2>
              <p className="qr-muted">
                Add tickets, RSVP, menus, bookings, or any helpful website.
              </p>
              {data.links.map((l, i) => (
                <div className="qr-link-editor" key={i}>
                  <label className="qr-field">
                    Button label
                    <input
                      value={l.label}
                      maxLength={80}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          links: d.links.map((v, j) =>
                            j === i ? { ...v, label: e.target.value } : v,
                          ),
                        }))
                      }
                    />
                  </label>
                  <label className="qr-field">
                    URL
                    <input
                      type="url"
                      value={l.url}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          links: d.links.map((v, j) =>
                            j === i ? { ...v, url: e.target.value } : v,
                          ),
                        }))
                      }
                    />
                  </label>
                  <div className="qr-inline">
                    <button
                      disabled={i === 0}
                      onClick={() =>
                        setData((d) => {
                          const links = [...d.links];
                          [links[i - 1], links[i]] = [links[i], links[i - 1]];
                          return { ...d, links };
                        })
                      }
                    >
                      Move up ↑
                    </button>
                    <button
                      onClick={() =>
                        setData((d) => ({
                          ...d,
                          links: d.links.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
              <button
                className="cs-button"
                disabled={data.links.length >= 20}
                onClick={() =>
                  setData((d) => ({
                    ...d,
                    links: [...d.links, { label: "", url: "" }],
                  }))
                }
              >
                + Add link
              </button>
              <h2>More images & videos</h2>
              {data.media.map((m, i) => (
                <div className="qr-link-editor" key={i}>
                  <label className="qr-field">
                    {m.kind} URL
                    <input
                      value={m.source}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          media: d.media.map((v, j) =>
                            j === i ? { ...v, source: e.target.value } : v,
                          ),
                        }))
                      }
                    />
                  </label>
                  <Upload
                    onBusy={onUploadBusy}
                    kind={m.kind}
                    onComplete={(source) =>
                      setData((d) => ({
                        ...d,
                        media: d.media.map((v, j) =>
                          j === i ? { ...v, source } : v,
                        ),
                      }))
                    }
                  />
                  <label className="qr-field">
                    Description
                    <input
                      value={m.alt}
                      maxLength={300}
                      onChange={(e) =>
                        setData((d) => ({
                          ...d,
                          media: d.media.map((v, j) =>
                            j === i ? { ...v, alt: e.target.value } : v,
                          ),
                        }))
                      }
                    />
                  </label>
                  <button
                    disabled={uploading > 0}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        media: d.media.filter((_, j) => j !== i),
                      }))
                    }
                  >
                    Remove media
                  </button>
                </div>
              ))}
              <div className="qr-inline">
                {(["image", "video"] as const).map((kind) => (
                  <button
                    className="cs-button"
                    key={kind}
                    disabled={data.media.length >= 5}
                    onClick={() =>
                      setData((d) => ({
                        ...d,
                        media: [...d.media, { kind, source: "", alt: "" }],
                      }))
                    }
                  >
                    + {kind}
                  </button>
                ))}
              </div>
            </>
          )}
          {step === "QR design" && (
            <>
              <h2>Make the scan yours.</h2>
              <LiveQr
                color={data.color}
                logo={data.logo}
                caption={data.caption}
                title={data.title}
                slug={record?.slug}
                fit={data.logoFit}
              />
              <label className="qr-field">
                Center image fit
                <select
                  value={data.logoFit || "contain"}
                  onChange={(e) => patch({ logoFit: e.target.value })}
                >
                  <option value="contain">Keep the full image</option>
                  <option value="cover">Crop to a square</option>
                </select>
              </label>
              <p className="qr-muted">
                Your caption sits below the code. A small center image leaves
                space for a reliable scan.
              </p>
              {field("Caption", "caption", data.caption)}
              <label className="qr-field">
                QR color
                <input
                  type="color"
                  value={data.color}
                  disabled={!features.colors}
                  onChange={(e) => patch({ color: e.target.value })}
                />
              </label>
              {!features.colors && (
                <p className="qr-muted">
                  Custom colors require an eligible plan.
                </p>
              )}
              <Upload
                onBusy={onUploadBusy}
                kind="image"
                label="Upload center logo or image"
                disabled={!features.logo}
                onComplete={(logo) => patch({ logo })}
              />
              {!features.logo && (
                <p className="qr-muted">
                  Center logos require an eligible plan.
                </p>
              )}
              {data.logo && (
                <>
                  <img src={data.logo} alt="Center logo" width="80" />
                  <button onClick={() => patch({ logo: "" })}>
                    Remove logo
                  </button>
                </>
              )}
              <button
                className="cs-button"
                onClick={() => patch({ color: "#202520", logo: "" })}
              >
                Reset design
              </button>
              <p className="qr-muted">
                Publish your design to generate a scan-checked export. Changes
                to printed captions or logos require a new download.
              </p>
            </>
          )}
          {step === "Preview" && (
            <>
              <h2>Ready to share?</h2>
              <p>
                The preview shows your current draft. Publish to make it
                available to visitors.
              </p>
              <p className="qr-muted">
                Visitors need internet access. They do not need an account.
              </p>
              {record?.published && (
                <>
                  <a
                    className="qr-action"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={`/view/${record.slug}`}
                  >
                    Open published page <ArrowUpRightIcon />
                  </a>
                  <button
                    className="cs-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(
                          new URL(
                            `/q/${record.slug}`,
                            window.location.origin,
                          ).toString(),
                        );
                        setMessage("QR link copied.");
                      } catch {
                        setError(
                          "Could not copy. Open your published page and copy its QR link.",
                        );
                      }
                    }}
                  >
                    Copy QR link
                  </button>
                  {changed && (
                    <p className="qr-muted">
                      Downloads below use the published version. Publish your
                      changes to update them.
                    </p>
                  )}
                  {!previewError ? (
                    <img
                      src={`/api/qr-codes/${record.slug}/export?preview=1&r=${record.revision}`}
                      className="qr-export-preview"
                      alt="Published QR with title and caption"
                      onError={() => setPreviewError(true)}
                    />
                  ) : (
                    <p role="alert">
                      QR preview unavailable. Try publishing again or remove the
                      center logo.
                    </p>
                  )}
                  <div className="qr-inline">
                    <a
                      className="cs-button"
                      href={`/api/qr-codes/${record.slug}/export`}
                    >
                      Download QR card
                    </a>
                    <a
                      className="cs-button"
                      href={`/api/qr-codes/${record.slug}/export?layout=plain`}
                    >
                      Plain PNG
                    </a>
                    {features.svg && (
                      <a
                        className="cs-button"
                        href={`/api/qr-codes/${record.slug}/export?format=svg`}
                      >
                        SVG
                      </a>
                    )}
                  </div>
                </>
              )}
            </>
          )}
          <div className="qr-save-bar">
            <p role="status">
              {record?.published
                ? changed
                  ? "Published · draft changes pending"
                  : "Published"
                : "Private draft"}
            </p>
            <div className="qr-inline">
              <button
                className="cs-button"
                disabled={busy || uploading > 0}
                onClick={() => void save("save")}
              >
                {busy ? "Saving…" : "Save draft"}
              </button>
              <button
                className="cs-button cs-primary"
                disabled={busy || uploading > 0}
                onClick={() => void save("publish")}
              >
                {record?.published ? "Publish updates" : "Publish QR"}
              </button>
            </div>
            {error && (
              <p className="cs-error" role="alert">
                {error}
              </p>
            )}
            {message && <p role="status">{message}</p>}
          </div>
        </fieldset>
        <aside className="qr-preview">
          <p className="qr-eyebrow">Live visitor preview · draft</p>
          <Experience data={data} preview />
        </aside>
      </div>
    </div>
  );
}
