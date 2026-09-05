import { dataUrlToBlob, downloadBlob } from "./download";

const WIDTH = 720;
const HEIGHT = 920;

function roundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Could not load QR image"));
    image.src = src;
  });
}

function fitFontSize(
  ctx: CanvasRenderingContext2D,
  text: string,
  weight: number,
  maxWidth: number,
): number {
  let size = 48;
  while (size > 28) {
    ctx.font = `${weight} ${size}px Arial, Helvetica, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) return size;
    size -= 2;
  }
  return size;
}

/**
 * Download a scan-safe QR card with the person's name rendered above the code.
 * The QR itself is never cropped and retains its original white quiet zone.
 */
export async function downloadQrCard({
  qrUrl,
  firstName,
  lastName,
  accentColor,
  filename,
}: {
  qrUrl: string;
  firstName: string;
  lastName: string;
  accentColor: string;
  filename: string;
}): Promise<void> {
  const qrImage = await loadImage(qrUrl);
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");

  // Transparent pixels around the card allow the soft shadow to be visible.
  ctx.clearRect(0, 0, WIDTH, HEIGHT);
  ctx.save();
  ctx.shadowColor = "rgba(15, 23, 42, 0.12)";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 8;
  roundedRect(ctx, 24, 20, 672, 880, 28);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.restore();

  roundedRect(ctx, 24, 20, 672, 880, 28);
  ctx.strokeStyle = "#e5e7eb";
  ctx.lineWidth = 2;
  ctx.stroke();

  const given = firstName.trim();
  const family = lastName.trim();
  const lines = [given, family].filter(Boolean);
  const renderedLines = lines.length ? lines : ["Contact"];
  const nameX = 88;
  const maxNameWidth = 544;
  let nameY = renderedLines.length === 1 ? 112 : 78;

  ctx.fillStyle = "#262626";
  ctx.textBaseline = "top";
  renderedLines.forEach((line, index) => {
    const weight = index === 0 ? 700 : 400;
    const fontSize = fitFontSize(ctx, line, weight, maxNameWidth);
    ctx.font = `${weight} ${fontSize}px Arial, Helvetica, sans-serif`;
    ctx.fillText(line, nameX, nameY);
    nameY += 54;
  });

  ctx.fillStyle = "#262626";
  roundedRect(ctx, nameX, 194, 150, 6, 3);
  ctx.fill();

  // The colored frame matches the active brand while the inner white field
  // maintains the high contrast and quiet zone required for reliable scanning.
  roundedRect(ctx, 64, 238, 592, 592, 54);
  ctx.fillStyle = accentColor || "#287ca3";
  ctx.fill();

  roundedRect(ctx, 100, 274, 520, 520, 30);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  ctx.save();
  roundedRect(ctx, 100, 274, 520, 520, 30);
  ctx.clip();
  ctx.drawImage(qrImage, 104, 278, 512, 512);
  ctx.restore();

  downloadBlob(filename, dataUrlToBlob(canvas.toDataURL("image/png")));
}
