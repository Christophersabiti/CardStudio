import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { stampSvg, type StampSvgDesign } from "../lib/stamp-render";

const design: StampSvgDesign = {
  shape: "Circle", color: "#1d4ed8", border: 4, borderStyle: "Double ring", aging: 0,
  items: [
    { id: "top", text: "SABTECH ONLINE", place: "top", curved: true, size: 12, bold: true, letterSpacing: 1 },
    { id: "mid", text: "Zoë’s Café — 16/11/2026", place: "center", size: 12, bold: false, letterSpacing: 0, color: "#dc2626", dx: 10, dy: -20 },
    { id: "stars", text: "★ ✦ ☆", place: "center", size: 13, bold: true, letterSpacing: 0, dy: 30 },
    { id: "odd", text: "✍", place: "bottom", size: 12, bold: true, letterSpacing: 0 },
  ],
};

test("stamp export outlines text so it never depends on server fonts", async () => {
  const svg = await stampSvg(design);
  assert.ok(!svg.includes("<text"), "no SVG text elements remain");
  assert.ok((svg.match(/<path /g) || []).length >= 20, "letters are drawn as outlines");
  assert.equal((svg.match(/<polygon points=/g) || []).length, 3, "stars the font lacks are drawn as shapes");
  assert.ok(svg.includes('transform="translate(10 -20)"'), "free positioning offset is applied");
  assert.ok(svg.includes('fill="#dc2626"'), "per-element ink is kept");
});

test("stamp export rasterizes with visible ink inside the stamp", async () => {
  const png = await sharp(Buffer.from(await stampSvg(design))).resize(500, 500).png().toBuffer();
  const { data, info } = await sharp(png).extract({ left: 150, top: 200, width: 200, height: 60 }).raw().toBuffer({ resolveWithObject: true });
  let ink = 0;
  for (let i = 0; i < data.length; i += info.channels) if (data[i + 3] > 128) ink++;
  assert.ok(ink > 300, `centre text produced ${ink} opaque pixels`);
});
