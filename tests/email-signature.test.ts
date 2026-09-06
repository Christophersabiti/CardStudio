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
