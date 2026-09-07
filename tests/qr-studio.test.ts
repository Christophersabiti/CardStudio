import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import jsQR from "jsqr";
import {
  qrSchema,
  qrDraftSchema,
  emptyQr,
  localToUtc,
  calendar,
  videoEmbed,
  assetReferences,
} from "../lib/qr-studio/schema";
import { renderQr } from "../lib/qr-studio/render";
import { inspectMp4 } from "../lib/qr-studio/mp4";
const event = {
  ...emptyQr("event"),
  title: "Launch",
  start: "2026-09-07T10:00:00.000Z",
  end: "2026-09-07T12:00:00.000Z",
};
test("QR schema rejects unsafe URLs, inverted dates and low contrast", () => {
  assert.equal(qrSchema.safeParse(event).success, true);
  for (const data of [
    { ...event, end: "2026-09-07T09:00:00Z" },
    { ...event, color: "#ffffff" },
    { ...event, links: [{ label: "Run", url: "javascript:alert(1)" }] },
    {
      ...event,
      links: [{ label: "Run", url: "https://user:password@example.com" }],
    },
    { ...event, timezone: "unknown" },
    { ...event, owner_id: "fake" },
  ])
    assert.equal(qrSchema.safeParse(data).success, false);
});
test("timezone conversion handles Kampala and rejects DST gaps and ambiguity", () => {
  assert.equal(
    localToUtc("2026-09-07T13:00", "Africa/Kampala"),
    "2026-09-07T10:00:00.000Z",
  );
  assert.equal(
    localToUtc("2026-07-07T13:00", "America/New_York"),
    "2026-07-07T17:00:00.000Z",
  );
  assert.throws(
    () => localToUtc("2026-03-08T02:30", "America/New_York"),
    /does not exist/,
  );
  assert.throws(
    () => localToUtc("2026-11-01T01:30", "America/New_York"),
    /occurs twice/,
  );
});
test("calendar escapes injection, folds unicode and preserves UTC instants", () => {
  const d = qrSchema.parse({
    ...event,
    title: "Conference, East; Africa\nSUMMARY:evil " + "✨".repeat(90),
  });
  if (d.type !== "event") throw Error();
  const ics = calendar(d, "sampleqr");
  assert.match(ics, /DTSTART:20260907T100000Z/);
  assert.match(ics, /Conference\\, East\\; Africa\\nSUMMARY:evil/);
  for (const line of ics.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});
test("video embeds use exact hostnames and known ID formats", () => {
  assert.equal(
    videoEmbed("https://youtu.be/dQw4w9WgXcQ"),
    "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
  );
  assert.equal(
    videoEmbed("https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ"),
    null,
  );
  assert.equal(
    videoEmbed("https://vimeo.com/1234"),
    "https://player.vimeo.com/video/1234",
  );
});
test("references include both branding and media", () => {
  const path = "/api/qr-assets/11111111-1111-4111-8111-111111111111";
  const d = qrSchema.parse({
    ...emptyQr("video"),
    title: "Watch",
    source: path,
    logo: path,
  });
  assert.equal(assetReferences(d).length, 2);
});
test("branded PNG and SVG remain readable and escape caption markup", async () => {
  const logo = await sharp({
    create: { width: 100, height: 100, channels: 4, background: "#d53f62" },
  })
    .png()
    .toBuffer();
  for (const url of [
    "https://card.studio/q/abcdefgh",
    "https://card-studio-example.vercel.app/q/abcdefgh",
  ]) {
    const r = await renderQr({
      url,
      color: "#202520",
      logo,
      title: "An event <script>",
      caption: "Scan & join",
      card: true,
    });
    assert.ok(!r.svg.includes("<script>"));
    for (const width of [400, 720]) {
      const image = await sharp(r.png)
        .resize({ width })
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });
      assert.equal(
        jsQR(
          new Uint8ClampedArray(image.data),
          image.info.width,
          image.info.height,
        )?.data,
        url,
      );
    }
  }
});
test("MP4 validation rejects arbitrary and malformed files", () => {
  for (const input of [
    Buffer.from("fake mp4"),
    Buffer.alloc(64),
    Buffer.from("<script>alert(1)</script>"),
  ])
    assert.throws(() => inspectMp4(input));
});

test("incomplete private drafts are recoverable but cannot publish", () => {
  for (const type of [
    "event",
    "image",
    "video",
    "links",
    "location",
    "url",
  ] as const) {
    assert.equal(qrDraftSchema.safeParse(emptyQr(type)).success, true);
    assert.equal(qrSchema.safeParse(emptyQr(type)).success, false);
  }
});
test("a real H.264/AAC MP4 fixture passes container inspection", () => {
  const file = readFileSync(
    new URL("./fixtures/qr-video.mp4", import.meta.url),
  );
  const meta = inspectMp4(file);
  assert.ok(meta.duration >= 1 && meta.duration < 2);
  assert.throws(
    () => inspectMp4(file.subarray(0, 300)),
    /Invalid|Missing|standard/,
  );
});
