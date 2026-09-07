import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
const xml = (s: string) =>
  s.replace(
    /[<>&"']/g,
    (c) =>
      ({
        "<": "&lt;",
        ">": "&gt;",
        "&": "&amp;",
        '"': "&quot;",
        "'": "&apos;",
      })[c]!,
  );
export async function renderQr({
  url,
  color,
  logo,
  title,
  caption,
  card = false,
  fit = "contain",
}: {
  url: string;
  color: string;
  logo?: Buffer;
  title: string;
  caption: string;
  card?: boolean;
  fit?: "contain" | "cover";
}) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "H" });
  const n = qr.modules.size,
    margin = 4,
    unit = 12,
    size = (n + margin * 2) * unit;
  let modules = "",
    reserved = "";
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const rect = `<rect x="${(x + margin) * unit}" y="${(y + margin) * unit}" width="${unit}" height="${unit}" fill="${qr.modules.get(y, x) ? color : "#fff"}"/>`;
      if (qr.modules.get(y, x)) modules += rect;
      if (qr.modules.isReserved(y, x)) reserved += rect;
    }
  let mark = "";
  if (logo) {
    const safe = await sharp(logo)
      .resize(128, 128, { fit, background: "white" })
      .png()
      .toBuffer();
    const width = Math.floor(n * 0.14) * unit;
    const pos = (size - width) / 2;
    mark = `<rect x="${pos - unit / 2}" y="${pos - unit / 2}" width="${width + unit}" height="${width + unit}" fill="#fff"/><image x="${pos}" y="${pos}" width="${width}" height="${width}" href="data:image/png;base64,${safe.toString("base64")}"/>${reserved}`;
  }
  const code = `<rect width="${size}" height="${size}" fill="#fff"/>${modules}${mark}`;
  const plain = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${code}</svg>`;
  const decoded = await sharp(Buffer.from(plain))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  if (
    jsQR(
      new Uint8ClampedArray(decoded.data),
      decoded.info.width,
      decoded.info.height,
    )?.data !== url
  )
    throw Error(
      "This QR design could not be verified. Remove the logo and try again.",
    );
  const wrap = (s: string, max: number) => {
    const words = s.split(/\s+/),
      out: string[] = [];
    let line = "";
    for (const word of words) {
      for (let i = 0; i < word.length; i += max) {
        const part = word.slice(i, i + max);
        if ((line + " " + part).trim().length > max) {
          out.push(line);
          line = "";
        }
        line = (line + " " + part).trim();
      }
    }
    if (line) out.push(line);
    return out;
  };
  const titles = wrap(title, Math.max(12, Math.floor((size - 48) / 26))),
    captions = wrap(caption, Math.max(16, Math.floor((size - 48) / 20))),
    top = card ? 40 + titles.length * 32 : 0,
    bottom = card ? 40 + captions.length * 24 : 0;
  const svg = card
    ? `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size + top + bottom}" viewBox="0 0 ${size} ${size + top + bottom}"><rect width="100%" height="100%" fill="#fff"/>${titles.map((l, i) => `<text x="${size / 2}" y="${36 + i * 32}" text-anchor="middle" font-family="Arial,sans-serif" font-size="26" font-weight="700" fill="#202520">${xml(l)}</text>`).join("")}<g transform="translate(0 ${top})">${code}</g>${captions.map((l, i) => `<text x="${size / 2}" y="${top + size + 24 + i * 24}" text-anchor="middle" font-family="Arial,sans-serif" font-size="20" fill="#202520">${xml(l)}</text>`).join("")}</svg>`
    : plain;
  return { svg, png: await sharp(Buffer.from(svg)).png().toBuffer() };
}
