import { readFile } from "node:fs/promises";
import path from "node:path";
import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb } from "pdf-lib";
import QRCode from "qrcode";
import sharp from "sharp";
import jsQR from "jsqr";
import { zipSync } from "fflate";
import type { CardData } from "../types";
import type { Brand } from "../brand";
import { extractLogoColors, mix, readable, resolveCardColors } from "../card-colors";
import { PrintError, type PrintPreset } from "./policy";

export const TEMPLATE_VERSION = "reference-v1";
export const CARD_WIDTH = 85.6, CARD_HEIGHT = 54;
const PT = 72 / 25.4;
const assets = (name: string) => path.join(process.cwd(), "assets", "print-package", name);
const n = (value: number) => Number(value.toFixed(5));
type Font = ReturnType<typeof fontkit.create>;
type Shape = { type: "path"; d: string; fill: string } | { type: "rect"; x: number; y: number; w: number; h: number; fill: string } | { type: "image"; x: number; y: number; w: number; h: number; png: Buffer };
let fonts: Promise<{ regular: Font; bold: Font }> | undefined;
function loadFonts() {
  return fonts ||= Promise.all([readFile(assets("NotoSans-Regular.ttf")), readFile(assets("NotoSans-Bold.ttf"))]).then(([a, b]) => ({ regular: fontkit.create(a), bold: fontkit.create(b) })).catch(error => { fonts = undefined; throw error; });
}
function width(font: Font, text: string, size: number) {
  return font.layout(text).positions.reduce((sum, p) => sum + p.xAdvance, 0) / font.unitsPerEm * size;
}
function lines(font: Font, value: string, size: number, maxWidth: number): string[] {
  const out: string[] = [];
  for (const paragraph of value.trim().split(/\r?\n/)) {
    let line = "";
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && width(font, `${line} ${word}`, size) > maxWidth) { out.push(line); line = ""; }
      if (width(font, word, size) > maxWidth) {
        for (const char of word) {
          if (line && width(font, line + char, size) > maxWidth) { out.push(line); line = ""; }
          line += char;
        }
      } else line = line ? `${line} ${word}` : word;
    }
    if (line) out.push(line);
  }
  return out;
}
/** Glyph outlines give PDF and SVG exactly the same typography on every host. */
function textShape(font: Font, text: string, x: number, top: number, size: number, fill: string): Shape {
  const run = font.layout(text);
  if (run.glyphs.some(g => g.id === 0)) throw new PrintError("A character in your card is not supported by the print font. Use a supported spelling before exporting.");
  let cursor = x, d = "";
  const scale = size / font.unitsPerEm, baseline = top + size;
  run.glyphs.forEach((glyph, index) => {
    const pos = run.positions[index];
    for (const command of (glyph.path as unknown as { commands: { command: string; args: number[] }[] }).commands) {
      const op = ({ moveTo: "M", lineTo: "L", quadraticCurveTo: "Q", bezierCurveTo: "C", closePath: "Z" } as Record<string, string>)[command.command];
      if (!op) throw new PrintError("Unsupported font outline.");
      d += op + command.args.map((v, i) => n(i % 2 === 0 ? cursor + (v + pos.xOffset) * scale : baseline - (v + pos.yOffset) * scale)).join(" ");
    }
    cursor += pos.xAdvance * scale;
  });
  return { type: "path", d, fill };
}
function block(shapes: Shape[], font: Font, value: string, x: number, y: number, w: number, maxLines: number, size: number, min: number, fill: string, label: string) {
  if (!value.trim()) return 0;
  let rows = lines(font, value, size, w);
  while (rows.length > maxLines && size > min) { size = Math.max(min, size - .1); rows = lines(font, value, size, w); }
  if (rows.length > maxLines) throw new PrintError(`${label} does not fit the printed card. Shorten it before downloading.`);
  rows.forEach((line, i) => shapes.push(textShape(font, line, x, y + i * size * 1.16, size, fill)));
  return rows.length * size * 1.16;
}
function rounded(x: number, y: number, w: number, h: number, r: number, fill: string): Shape {
  return { type: "path", fill, d: `M${x+r} ${y}H${x+w-r}Q${x+w} ${y} ${x+w} ${y+r}V${y+h-r}Q${x+w} ${y+h} ${x+w-r} ${y+h}H${x+r}Q${x} ${y+h} ${x} ${y+h-r}V${y+r}Q${x} ${y} ${x+r} ${y}Z` };
}
function gradient(shapes: Shape[], x: number, y: number, w: number, h: number, a: string, b: string) {
  for (let i = 0; i < 128; i++) shapes.push({ type: "rect", x: x + w * i / 128, y, w: w / 128 + .08, h, fill: mix(a,b,i/127) });
}
function svgBody(shapes: Shape[]) {
  return shapes.map(s => s.type === "path" ? `<path d="${s.d}" fill="${s.fill}"/>` : s.type === "rect" ? `<rect x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" fill="${s.fill}"/>` : `<image x="${s.x}" y="${s.y}" width="${s.w}" height="${s.h}" href="data:image/png;base64,${s.png.toString("base64")}"/>`).join("");
}
function svg(shapes: Shape[], pixelWidth = 1011) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${pixelWidth}" height="${Math.round(pixelWidth*CARD_HEIGHT/CARD_WIDTH)}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">${svgBody(shapes)}</svg>`;
}
async function placedImage(bytes: Buffer, x: number, y: number, w: number, h: number, circle = false): Promise<Shape> {
  const meta = await sharp(bytes).metadata();
  if (!meta.width || !meta.height) throw new PrintError("A print image could not be read.");
  const ppi = circle ? Math.min(meta.width / (w / 25.4), meta.height / (h / 25.4)) : Math.max(meta.width / (w / 25.4), meta.height / (h / 25.4));
  if (ppi < 150) throw new PrintError("Your photo or logo is too small for print. Upload a higher-resolution image (at least 150 PPI at its printed size).");
  const px = Math.ceil(w / 25.4 * 600), py = Math.ceil(h / 25.4 * 600);
  let image = sharp(bytes).resize(px,py,{fit:circle?"cover":"contain",background:"#ffffff00"}).ensureAlpha();
  if (circle) image = image.composite([{input:Buffer.from(`<svg width="${px}" height="${py}"><ellipse cx="${px/2}" cy="${py/2}" rx="${px/2}" ry="${py/2}" fill="white"/></svg>`),blend:"dest-in"}]);
  return { type: "image", x,y,w,h,png:await image.png().toBuffer() };
}
async function pdf(shapes: Shape[], preset: PrintPreset, title: string, background: string) {
  const doc = await PDFDocument.create();
  const bleed = preset === "bleed" ? 3 : 0;
  const w = (CARD_WIDTH + bleed*2)*PT, h = (CARD_HEIGHT + bleed*2)*PT;
  const page = doc.addPage([w,h]);
  page.setTrimBox(bleed*PT,bleed*PT,CARD_WIDTH*PT,CARD_HEIGHT*PT);
  page.setBleedBox(0,0,w,h);
  const color = (hex: string) => rgb(...([1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255) as [number,number,number]));
  page.drawRectangle({x:0,y:0,width:w,height:h,color:color(background)});
  for (const s of shapes) {
    if (s.type === "path" && s.d) page.drawSvgPath(s.d, {x:bleed*PT,y:h-bleed*PT,scale:PT,color:color(s.fill)});
    else if (s.type === "rect") page.drawRectangle({x:(s.x+bleed)*PT,y:h-(s.y+s.h+bleed)*PT,width:s.w*PT,height:s.h*PT,color:color(s.fill)});
    else if (s.type === "image") page.drawImage(await doc.embedPng(s.png),{x:(s.x+bleed)*PT,y:h-(s.y+s.h+bleed)*PT,width:s.w*PT,height:s.h*PT});
  }
  doc.setTitle(title); doc.setSubject(`${TEMPLATE_VERSION}; RGB; ${CARD_WIDTH} x ${CARD_HEIGHT} mm; ${bleed} mm bleed; text outlined`);
  doc.setCreator("Card Studio"); doc.setProducer("Card Studio print package");
  return doc.save();
}

export async function renderPrintPackage({ data, payload, mode, brand, photo, logo, preset = "exact", revision }: {
  data: CardData; payload: string; mode: "dynamic" | "offline"; brand: Brand; photo?: Buffer; logo?: Buffer; preset?: PrintPreset; revision: number;
}) {
  const {regular, bold} = await loadFonts();
  let detected;
  if (logo && data.logo && !data.logoColors && (!data.appearance || data.appearance.mode === "logo")) {
    detected = extractLogoColors(await sharp(logo).resize(64,64,{fit:"inside"}).ensureAlpha().raw().toBuffer());
  }
  const colors = resolveCardColors(data,detected) || [brand.colors.primary,brand.colors.secondary];
  const [primary,secondary] = colors;
  const ink = "#151821", titleColor = readable(primary,["#ffffff"],false);
  const name = [data.firstName,data.lastName].filter(Boolean).join(" ") || data.organization;
  const front: Shape[] = [{type:"rect",x:0,y:0,w:CARD_WIDTH,h:CARD_HEIGHT,fill:"#ffffff"}];
  const given = data.firstName || (!data.lastName ? data.organization : data.lastName);
  block(front,bold,given,16,3.6,63,1,4.0,2.8,ink,"Front name");
  if (data.firstName && data.lastName) block(front,regular,data.lastName,16,8.0,63,1,3.6,2.8,ink,"Last name");
  front.push({type:"rect",x:16,y:13.2,w:10,h:.35,fill:ink});
  front.push(rounded(23.9,15.3,37.8,36.3,2.8,primary));
  front.push(rounded(26.3,17.4,33,32,1.4,"#ffffff"));
  let code;
  try { code = QRCode.create(payload,{errorCorrectionLevel:"M"}); }
  catch { throw new PrintError("This offline contact has too much information for a QR. Shorten the details or choose Online."); }
  const unit = 31/(code.modules.size+8);
  if (unit < .25) throw new PrintError("This QR is too dense for a printed card. Shorten the offline contact details or use Online.");
  let modules = "";
  for (let y=0;y<code.modules.size;y++) for(let x=0;x<code.modules.size;x++) if(code.modules.get(y,x)) modules += `M${n(27.3+(x+4)*unit)} ${n(17.9+(y+4)*unit)}h${n(unit)}v${n(unit)}h-${n(unit)}Z`;
  front.push({type:"path",d:modules,fill:"#000000"});
  const back: Shape[] = [{type:"rect",x:0,y:0,w:CARD_WIDTH,h:CARD_HEIGHT,fill:"#ffffff"}];
  gradient(back,0,0,CARD_WIDTH,1.3,primary,brand.colors.accent);
  if(photo) back.push(await placedImage(photo,5,4.5,12,12,true));
  else { back.push(rounded(5,4.5,12,12,6,"#eef0f6")); block(back,bold,([data.firstName[0],data.lastName[0]].filter(Boolean).join("") || name[0]).toUpperCase(),7,8,8,1,3.8,2.8,titleColor,"Initials"); }
  block(back,bold,name,21,3.3,61,1,3.55,2.7,ink,"Name");
  const titleH = block(back,bold,data.title,21,7.8,61,3,2.65,2.25,titleColor,"Job title");
  block(back,regular,data.organization,21,Math.max(11.2,8.3+titleH),61,1,2.35,2.15,"#636571","Organization");
  const left = [...data.phones.filter(p=>p.value).map(p=>({label:"phone",value:p.value})),...data.emails.filter(Boolean).map(value=>({label:"email",value}))];
  const right = data.websites.filter(Boolean).map(value=>({label:"web",value:value.replace(/^https?:\/\//,"").replace(/\/$/,"")}));
  if (left.length > 4 || right.length > 4) throw new PrintError("The printed back fits four phone/email rows and four websites. Reduce these fields before downloading; no details have been omitted.");
  const icons: Record<string,string> = {
    phone:"M5 2L8 2L10 7L8 9C10 13 12 15 16 16L18 14L22 16L22 20C22 25 2 17 2 5Z",
    email:"M2 4H22V20H2ZM2 4L12 13L22 4",
    web:"M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2M2 12H22M12 2C6 8 6 16 12 22C18 16 18 8 12 2",
  };
  // Small contact icons are rasterized once; all contact text remains outlined.
  for (const [column,rows] of [left,right].entries()) for(const [i,row] of rows.entries()) {
    const x = column ? 47 : 5, y = 20+i*3.25;
    const icon = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="72" height="72" viewBox="0 0 24 24"><path d="${icons[row.label]}" fill="none" stroke="#151821" stroke-width="1.6" stroke-linejoin="round"/></svg>`);
    back.push({type:"image",x,y:y+.2,w:2.6,h:2.6,png:await sharp(icon).png().toBuffer()});
    block(back,regular,row.value,x+4,y,column?30:37,1,2.25,2.05,ink,column?"Website":"Contact detail");
  }
  const socialKeys = ["linkedin","twitter","facebook","instagram","youtube","tiktok","github","whatsapp"].filter(key=>data.socials[key]);
  for (const [index,key] of socialKeys.entries()) back.push({type:"image",x:9+index*4.8,y:33.4,w:3.8,h:3.8,png:await readFile(path.join(process.cwd(),"public","signature-icons",`${key}.png`))});
  const aside = mix("#11182b",secondary,.28);
  gradient(back,0,37.8,CARD_WIDTH,16.2,aside,mix("#11182b",primary,.36));
  block(back,regular,mode === "dynamic" ? "PERSONAL DETAILS · ONLINE PROFILE QR" : "PERSONAL DETAILS · OFFLINE CONTACT QR",5,38.4,55,1,1.45,1.45,"#ffffff","Section label");
  const footerWidth = 54;
  let fy = 40.5;
  fy += block(back,regular,data.location,5,fy,footerWidth,1,2.15,2.05,"#ffffff","Location");
  if(data.location) fy += .25;
  fy += block(back,bold,data.role,5,fy,footerWidth,1,2.15,1.8,"#ffffff","Membership role");
  if(data.role) fy += .25;
  const remaining = Math.floor((53.2-fy)/(2.05*1.16));
  if(data.tagline && remaining < 1) throw new PrintError("The personal-details section is full. Shorten your location, role, or tagline before printing.");
  block(back,regular,data.tagline,5,fy,footerWidth,Math.min(3,remaining),2.05,2.05,"#ffffff","Tagline");
  if(logo) {back.push(rounded(62,40.2,20,10.8,1.5,"#ffffff"));back.push(await placedImage(logo,63,41.2,18,8.8));}
  else block(back,bold,brand.name,62,40.1,20,2,2.3,2.05,"#ffffff","Brand name");
  // Verify the complete flat front at final 300-DPI scale, not just the QR source.
  const frontSvg = svg(front), backSvg = svg(back);
  const decoded = await sharp(Buffer.from(frontSvg)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  if(jsQR(new Uint8ClampedArray(decoded.data),decoded.info.width,decoded.info.height)?.data !== payload) throw new PrintError("The printed QR could not be verified. Shorten the contact or choose Online.");
  const [frontPdf,backPdf,mockup] = await Promise.all([
    pdf(front,preset,`${name} — Front — r${revision}`,"#ffffff"),
    // Background strips extend through bleed without scaling the trimmed artwork.
    pdf(preset === "bleed" ? [{type:"rect",x:-3,y:38.5,w:CARD_WIDTH+6,h:18.5,fill:aside},...back,{type:"rect",x:-3,y:-3,w:CARD_WIDTH+6,h:3,fill:primary},{type:"rect",x:-3,y:38.5,w:3,h:18.5,fill:aside},{type:"rect",x:CARD_WIDTH,y:38.5,w:3,h:18.5,fill:mix("#11182b",primary,.36)}] : back,preset,`${name} — Back — r${revision}`,"#ffffff"),
    renderMockup(front,back,regular,bold,mode),
  ]);
  return { zip:zipSync({"front.pdf":frontPdf,"back.pdf":backPdf,"mockup.png":mockup},{level:0}), frontSvg, backSvg, mockup };
}

async function renderMockup(front: Shape[], back: Shape[], regular: Font, bold: Font, mode: string) {
  const body = (items: Shape[]) => svgBody(items);
  const scene = await readFile(assets("hand-scene.png"));
  const labels: Shape[] = [];
  const text = (value: string,x:number,y:number,size:number,strong=false,fill="#151821") => labels.push(textShape(strong?bold:regular,value,x,y,size,fill));
  text("Front Side",321,25,27,true,"#ffffff"); text("Back Side",1010,25,27,true,"#ffffff");
  text("85.6 mm",359,502,22,true);text("(3.37 inches)",340,530,17);
  text("54 mm",23,265,18,true);
  text("Standard card size",75,934,19,true);text("85.6 × 54 mm",75,966,17);
  text("Two separate print PDFs",440,934,19,true);text("Front and back · actual size",440,966,17);
  text(mode === "dynamic" ? "Online profile QR" : "Offline contact QR",832,934,19,true);text(mode === "dynamic" ? "Opens the published profile" : "Saves a fixed contact snapshot",832,966,17);
  text("Visual proof",1220,934,19,true);text("RGB · confirm printer settings",1190,966,16);
  const card = (id:string,items:Shape[],transform:string) => `<g transform="${transform}"><rect x="0" y=".8" width="85.6" height="54" rx="3.8" fill="#222" opacity=".3"/><g clip-path="url(#${id})">${body(items)}</g><rect width="85.6" height="54" rx="3.8" fill="none" stroke="#ffffff" stroke-width=".18"/></g>`;
  const out = `<svg xmlns="http://www.w3.org/2000/svg" width="3072" height="2048" viewBox="0 0 1536 1024"><defs>
    <linearGradient id="bg" x2="1" y2="1"><stop stop-color="#babbbd"/><stop offset="1" stop-color="#818385"/></linearGradient>
    <clipPath id="face"><rect width="85.6" height="54" rx="3.8"/></clipPath>
    <clipPath id="held"><path d="M263 200H1173Q1204 200 1204 231V574C1140 571 1091 607 1090 659C1085 709 1120 745 1160 773H263Q232 773 232 742V232Q232 200 263 200Z"/></clipPath>
  </defs><rect width="1536" height="1024" fill="url(#bg)"/>
  <rect x="292" y="15" width="219" height="54" rx="22" fill="#171e2e"/><rect x="976" y="15" width="212" height="54" rx="22" fill="#171e2e"/>
  ${card("face",front,"translate(115 85) scale(7.2)")}${card("face",back,"translate(795 85) scale(7.2)")}
  <path d="M115 498V518M731 498V518M115 508H324M511 508H731M82 85H96M89 85V474M82 474H96" fill="none" stroke="#151821" stroke-width="1.5"/>
  ${card("face",front,"translate(55 635) rotate(-12) skewX(7) scale(4.9 4.35)")}
  ${card("face",back,"translate(544 635) rotate(-10) skewX(7) scale(4.9 4.35)")}
  <g transform="translate(1016 553) scale(.338)"><image width="1536" height="1024" href="data:image/png;base64,${scene.toString("base64")}"/><g clip-path="url(#held)"><g transform="translate(232 200) scale(11.355 10.61)">${body(front)}</g></g></g>
  <rect y="913" width="1536" height="111" fill="#eeeff1"/><path d="M402 937V993M793 937V993M1160 937V993" stroke="#a9aaad"/>${body(labels)}</svg>`;
  return sharp(Buffer.from(out)).withMetadata({density:300}).png().toBuffer();
}
