// Raster assets preserve the existing brand glyphs in email clients without SVG support.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { SOCIALS } from '../lib/socials';
async function main() {
  await mkdir('public/signature-icons', { recursive: true });
  for (const social of SOCIALS) {
    const svg = renderToStaticMarkup(createElement(social.icon, { width: 72, height: 72, color: social.color, xmlns: 'http://www.w3.org/2000/svg' }));
    await sharp(Buffer.from(svg)).png().toFile(`public/signature-icons/${social.key}.png`);
  }
}
void main();
