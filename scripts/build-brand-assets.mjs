import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../public/brand/', import.meta.url);
const icon = await readFile(new URL('card-studio-icon.png', root));
for (const size of [16,32,180,192,512]) {
  await sharp(icon).resize(size,size).png().toFile(fileURLToPath(new URL(`icon-${size}.png`, root)));
}
const png = await sharp(icon).resize(32,32).png().toBuffer();
const header=Buffer.alloc(22);
header.writeUInt16LE(1,2); header.writeUInt16LE(1,4);
header[6]=32; header[7]=32; header.writeUInt16LE(1,10); header.writeUInt16LE(32,12);
header.writeUInt32LE(png.length,14); header.writeUInt32LE(22,18);
await writeFile(new URL('../favicon.ico',root),Buffer.concat([header,png]));
for (const [variant,color] of [['dark','#202421'],['light','#fcfcf8']]) {
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="240" viewBox="0 0 1200 240" role="img" aria-label="Card Studio"><title>Card Studio</title><image x="20" y="20" width="200" height="200" href="data:image/png;base64,${icon.toString('base64')}"/><text x="260" y="157" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="140" letter-spacing="-5" fill="${color}">card studio</text></svg>`;
 await writeFile(new URL(`card-studio-logo-${variant}.svg`,root),svg);
 await sharp(Buffer.from(svg)).resize(2400,480).png().toFile(fileURLToPath(new URL(`card-studio-logo-${variant}.png`,root)));
}
