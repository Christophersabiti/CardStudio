import QRCode from "qrcode";

export interface QrOptions {
  /** pixel width of the output PNG data URL */
  width?: number;
  dark?: string;
  light?: string;
}

/**
 * Generate a QR code as a PNG data URL. Works in both server components and the
 * browser. Error-correction level "M" balances density and resilience; margin 4
 * is the standard quiet zone.
 */
export async function qrDataUrl(text: string, opts: QrOptions = {}): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 4,
    width: opts.width ?? 512,
    color: {
      dark: opts.dark ?? "#17141C",
      light: opts.light ?? "#FFFFFF",
    },
  });
}
