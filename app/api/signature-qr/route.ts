import QRCode from 'qrcode';
import { safeUrl } from '@/lib/email-signature';
export const runtime = 'nodejs';
// Public image endpoint: encodes the supplied link locally, never fetches it.
export async function GET(request: Request) {
  const value = new URL(request.url).searchParams.get('url') || '';
  const url = value.length <= 1000 ? safeUrl(value) : '';
  if (!url) return new Response('A valid card URL is required.', { status: 400 });
  const png = await QRCode.toBuffer(url, { type: 'png', width: 240, margin: 4, errorCorrectionLevel: 'M' });
  return new Response(new Uint8Array(png), { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
}
