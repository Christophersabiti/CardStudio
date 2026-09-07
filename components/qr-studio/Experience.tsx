/* eslint-disable @next/next/no-img-element */
"use client";
import { ArrowUpRightIcon } from "@/components/icons";

import { useState, useEffect, startTransition } from "react";
import { directionsUrl, videoEmbed, type QrData } from "@/lib/qr-studio/schema";
function Media({
  source,
  kind,
  alt,
}: {
  source: string;
  kind: "image" | "video";
  alt: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!source)
    return (
      <p className="qr-muted">Add an image or video to preview it here.</p>
    );
  const embed = kind === "video" ? videoEmbed(source) : null;
  if (failed)
    return (
      <p>
        Media could not load.{" "}
        <a href={source} target="_blank" rel="noopener noreferrer">
          Open original <ArrowUpRightIcon />
        </a>
      </p>
    );
  if (kind === "image")
    return (
      <a
        href={source}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Open full image"
      >
        <img
          className="qr-media"
          src={source}
          alt={alt}
          onError={() => setFailed(true)}
          referrerPolicy="no-referrer"
        />
      </a>
    );
  if (embed)
    return (
      <iframe
        className="qr-video"
        src={embed}
        title={alt || "Video"}
        allow="fullscreen; picture-in-picture"
        allowFullScreen
        referrerPolicy="no-referrer"
      />
    );
  if (source.startsWith("/api/qr-assets/") || /\.mp4(?:\?|$)/i.test(source))
    return (
      <video
        className="qr-media"
        src={source}
        controls
        playsInline
        preload="metadata"
        onError={() => setFailed(true)}
      >
        Your browser cannot play this video.
      </video>
    );
  return (
    <a
      className="qr-action"
      href={source}
      target="_blank"
      rel="noopener noreferrer"
    >
      Open video <ArrowUpRightIcon />
    </a>
  );
}
export default function Experience({
  data: d,
  slug,
  preview = false,
}: {
  data: QrData;
  slug?: string;
  preview?: boolean;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    startTransition(() => setNow(Date.now()));
  }, []);
  const place = d.type === "event" || d.type === "location" ? d : null;
  const format = (s: string) => {
    try {
      return new Intl.DateTimeFormat("en-GB", {
        timeZone: d.type === "event" ? d.timezone : "UTC",
        dateStyle: "full",
        timeStyle: "short",
      }).format(new Date(s));
    } catch {
      return "Choose a date and time";
    }
  };
  return (
    <article
      className="qr-experience"
      style={{ "--qr-accent": d.color } as React.CSSProperties}
    >
      {d.cover && <img className="qr-cover" src={d.cover} alt="" />}
      <div className="qr-experience-body">
        <p className="qr-eyebrow">
          {d.type === "links" ? "Explore the links" : d.type}
        </p>
        <h1>{d.title || "Your title goes here"}</h1>
        {d.type === "event" && (
          <div className="qr-event-time">
            <strong>
              {d.status === "cancelled"
                ? "Event cancelled"
                : d.end && now > 0 && Date.parse(d.end) < now
                  ? "Event ended"
                  : "You’re invited"}
            </strong>
            <p>{format(d.start)}</p>
            <p>
              Until {format(d.end)} · {d.timezone}
            </p>
          </div>
        )}
        {d.description && <p className="qr-description">{d.description}</p>}
        {place && (place.venue || place.address) && (
          <section className="qr-place">
            <strong>{place.venue}</strong>
            <p>{place.address}</p>
            <a
              className="qr-action"
              href={directionsUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get directions <ArrowUpRightIcon />
            </a>
            {place.hours && <p className="qr-description">{place.hours}</p>}
            {place.phone && (
              <a href={`tel:${place.phone.replace(/[^+\d]/g, "")}`}>
                Call {place.phone}
              </a>
            )}
          </section>
        )}
        {d.type === "event" &&
          (slug && !preview ? (
            <a className="qr-action qr-secondary" href={`/q/${slug}/calendar`}>
              Add to calendar ↓
            </a>
          ) : (
            <span className="qr-muted">
              Calendar download available after publishing
            </span>
          ))}
        {(d.type === "image" || d.type === "video") && (
          <Media key={d.source} source={d.source} kind={d.type} alt={d.alt} />
        )}
        {d.type === "url" && (
          <a className="qr-action" href={d.url || undefined}>
            Visit website <ArrowUpRightIcon />
          </a>
        )}
        <div className="qr-link-list">
          {d.links.map((l, i) => (
            <a
              className="qr-action"
              key={i}
              href={
                slug && !preview ? `/q/${slug}/go/${i}` : l.url || undefined
              }
              target="_blank"
              rel="noopener noreferrer"
            >
              {l.label || "Link label"}
              <span><ArrowUpRightIcon /></span>
            </a>
          ))}
        </div>
        {d.media.map((m, i) => (
          <Media key={`${i}-${m.source}`} {...m} />
        ))}
        <footer className="qr-muted">Made with Card Studio</footer>
      </div>
    </article>
  );
}
