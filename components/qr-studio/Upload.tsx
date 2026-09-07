"use client";
import { useRef, useState, useEffect } from "react";
export default function Upload({
  kind,
  onComplete,
  label = "Upload file",
  disabled = false,
  onBusy,
}: {
  kind: "image" | "video";
  onComplete: (source: string) => void;
  label?: string;
  disabled?: boolean;
  onBusy?: (active: boolean) => void;
}) {
  const [progress, setProgress] = useState<number | null>(null),
    [error, setError] = useState("");
  const xhr = useRef<XMLHttpRequest | null>(null),
    asset = useRef("");
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      xhr.current?.abort();
    };
  }, []);
  async function upload(file: File) {
    onBusy?.(true);
    setError("");
    setProgress(0);
    asset.current = "";
    try {
      const limit = kind === "image" ? 10000000 : 50000000;
      if (file.size > limit)
        throw Error(`Choose a ${kind} smaller than ${limit / 1000000} MB.`);
      const r = await fetch("/api/qr-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, size: file.size }),
      });
      const data = await r.json();
      if (!r.ok) throw Error(data.error);
      asset.current = data.id;
      await new Promise<void>((resolve, reject) => {
        const x = new XMLHttpRequest();
        xhr.current = x;
        x.open("PUT", data.uploadUrl);
        x.setRequestHeader(
          "Content-Type",
          file.type || "application/octet-stream",
        );
        x.upload.onprogress = (e) => {
          if (e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 90));
        };
        x.onload = () =>
          x.status >= 200 && x.status < 300
            ? resolve()
            : reject(Error("Upload interrupted. Choose the file to retry."));
        x.onerror = () =>
          reject(Error("Upload interrupted. Check your connection and retry."));
        x.onabort = () => reject(Error("Upload cancelled."));
        x.send(file);
      });
      setProgress(95);
      const done = await fetch(`/api/qr-assets/${data.id}`, { method: "POST" });
      const result = await done.json();
      if (!done.ok) throw Error(result.error);
      if (mounted.current) onComplete(result.source);
      asset.current = "";
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed.");
      if (asset.current)
        await fetch(`/api/qr-assets/${asset.current}`, {
          method: "DELETE",
        }).catch(() => {});
    } finally {
      onBusy?.(false);
      setProgress(null);
      xhr.current = null;
    }
  }
  return (
    <div className="qr-upload">
      <label className="qr-upload-label">
        {label}
        <input
          type="file"
          accept={
            kind === "image" ? "image/png,image/jpeg,image/webp" : "video/mp4"
          }
          disabled={disabled || progress !== null}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
      </label>
      <small>
        {kind === "image"
          ? "PNG, JPEG or WebP · up to 10 MB"
          : "MP4 · H.264/AAC · up to 50 MB · 5 minutes"}
        . Your storage allowance applies. Temporary upload space is reserved
        until the upload link expires.
      </small>
      {progress !== null && (
        <div role="status">
          <progress value={progress} max="100" />
          {progress >= 95 ? " Validating…" : ` ${progress}%`}
          <button
            type="button"
            disabled={progress === 0 || progress >= 95}
            onClick={() => xhr.current?.abort()}
          >
            Cancel
          </button>
        </div>
      )}
      {error && (
        <p role="alert" className="cs-error">
          {error}
        </p>
      )}
    </div>
  );
}
