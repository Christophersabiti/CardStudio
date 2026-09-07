/* eslint-disable @next/next/no-img-element */
"use client";
import { useEffect, useState, startTransition } from "react";
import QRCode from "qrcode";
import jsQR from "jsqr";
export default function LiveQr({
  color,
  logo,
  caption,
  title,
  slug,
  fit = "contain",
}: {
  color: string;
  logo: string;
  caption: string;
  title: string;
  slug?: string;
  fit?: "contain" | "cover";
}) {
  const [image, setImage] = useState(""),
    [error, setError] = useState("");
  useEffect(() => {
    let live = true;
    startTransition(() => {
      setImage("");
      setError("");
    });
    async function build() {
      try {
        const url = new URL(
          `/q/${slug || "preview-only"}`,
          window.location.origin,
        ).toString();
        const qr = QRCode.create(url, { errorCorrectionLevel: "H" }),
          n = qr.modules.size,
          unit = 10,
          size = (n + 8) * unit;
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, size, size);
        ctx.fillStyle = color;
        for (let y = 0; y < n; y++)
          for (let x = 0; x < n; x++)
            if (qr.modules.get(y, x))
              ctx.fillRect((x + 4) * unit, (y + 4) * unit, unit, unit);
        if (logo) {
          const img = new Image();
          img.src = logo;
          await img.decode();
          const width = Math.floor(n * 0.14) * unit,
            pos = (size - width) / 2;
          ctx.fillStyle = "#fff";
          ctx.fillRect(
            pos - unit / 2,
            pos - unit / 2,
            width + unit,
            width + unit,
          );
          const scale =
            fit === "cover"
              ? Math.max(width / img.width, width / img.height)
              : Math.min(width / img.width, width / img.height);
          ctx.save();
          ctx.beginPath();
          ctx.rect(pos, pos, width, width);
          ctx.clip();
          ctx.drawImage(
            img,
            pos + (width - img.width * scale) / 2,
            pos + (width - img.height * scale) / 2,
            img.width * scale,
            img.height * scale,
          );
          ctx.restore();
          for (let y = 0; y < n; y++)
            for (let x = 0; x < n; x++)
              if (qr.modules.isReserved(y, x)) {
                ctx.fillStyle = qr.modules.get(y, x) ? color : "#fff";
                ctx.fillRect((x + 4) * unit, (y + 4) * unit, unit, unit);
              }
        }
        const pixels = ctx.getImageData(0, 0, size, size);
        if (jsQR(pixels.data, size, size)?.data !== url)
          throw Error(
            "This design is hard to scan. Choose a darker color or remove the image.",
          );
        if (live) setImage(canvas.toDataURL());
      } catch (e) {
        if (live)
          setError(e instanceof Error ? e.message : "Preview unavailable.");
      }
    }
    void build();
    return () => {
      live = false;
    };
  }, [color, logo, slug, fit]);
  return (
    <div className="qr-design-proof">
      <strong>{title || "Your title"}</strong>
      {image && <img src={image} alt="Draft QR design preview" />}
      {error && (
        <p role="alert" className="cs-error">
          {error}
        </p>
      )}
      <p>{caption}</p>
      <small className="qr-muted">
        Design preview. Use the published download for printing.
      </small>
    </div>
  );
}
