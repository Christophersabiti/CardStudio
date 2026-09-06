import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptySignature, signatureHtml, safeUrl } from '../lib/email-signature';
test('signature escapes user content and excludes executable URLs and styles', () => {
  const html = signatureHtml({ ...emptySignature, name: '<img src=x onerror=alert(1)>', photo: 'javascript:alert(1)', link: 'javascript:alert(1)', website: 'data:text/html,bad', color: 'red;position:absolute', font: 'Arial;position:absolute' });
  assert.ok(html.includes('&lt;img'));
  assert.ok(!html.includes('<img'));
  assert.ok(!html.includes('javascript:'));
  assert.ok(!html.includes('position:absolute'));
});
test('exports usable contact links and all supported layouts', () => {
  for (const layout of ['classic','stacked','minimal']) {
    const html = signatureHtml({ ...emptySignature, name: 'Sam & Co', email: 'sam@example.com', phone: '+256 700 123456', website: 'https://example.com', link: 'https://example.com/card', cta: 'Meet & connect', layout });
    assert.ok(html.includes('Sam &amp; Co'));
    assert.ok(html.includes('mailto:sam%40example.com'));
    assert.ok(html.includes('tel:+256700123456'));
    assert.ok(html.includes('Meet &amp; connect'));
    assert.ok(html.includes('role="presentation"'));
  }
  assert.equal(safeUrl('//evil.com'), '');
});
test('exports only filled valid social profiles with hosted brand icons', () => {
  const html = signatureHtml({ ...emptySignature, name: 'Sam', socials: { linkedin: 'https://linkedin.com/in/sam', instagram: '', twitter: 'javascript:alert(1)' } }, 'https://cards.example.com');
  assert.ok(html.includes('href="https://linkedin.com/in/sam"'));
  assert.ok(html.includes('src="https://cards.example.com/signature-icons/linkedin.png"'));
  assert.ok(!html.includes('instagram.png'));
  assert.ok(!html.includes('twitter.png'));
});
test('card QR follows the photo in every layout and disappears when cleared', () => {
  for (const layout of ['classic', 'stacked', 'minimal']) {
    const html = signatureHtml({ ...emptySignature, name: 'Sam', layout, photo: 'https://example.com/photo.png', cardUrl: 'https://example.com/c/sam' }, 'https://cards.example.com');
    assert.ok(html.indexOf('photo.png') < html.indexOf('/api/signature-qr'));
    assert.ok(html.includes('Save my contact'));
    assert.ok(html.includes('href="https://example.com/c/sam"'));
    assert.ok(html.includes('https://cards.example.com/api/signature-qr?url=https%3A%2F%2Fexample.com%2Fc%2Fsam'));
  }
  assert.ok(signatureHtml({...emptySignature, cardUrl:'https://example.com/c/sam'}).includes('Save my contact'));
  assert.ok(!signatureHtml({...emptySignature, cardUrl:'javascript:alert(1)'}).includes('signature-qr'));
  assert.ok(!signatureHtml(emptySignature).includes('signature-qr'));
});
test('public QR image decodes to the exact card link and rejects invalid input', async () => {
  const { GET } = await import('../app/api/signature-qr/route');
  const { PNG } = await import('pngjs');
  const { default: jsQR } = await import('jsqr');
  const link = 'https://cards.example.com/c/sam?ref=email&lang=en';
  const response = await GET(new Request(`https://cards.example.com/api/signature-qr?url=${encodeURIComponent(link)}`));
  assert.equal(response.headers.get('Content-Type'), 'image/png');
  const png = PNG.sync.read(Buffer.from(await response.arrayBuffer()));
  assert.equal(jsQR(new Uint8ClampedArray(png.data), png.width, png.height)?.data, link);
  assert.equal((await GET(new Request('https://cards.example.com/api/signature-qr?url=javascript:alert(1)'))).status, 400);
});
