import test from "node:test";
import assert from "node:assert/strict";
import { tourFor, tours } from "../lib/tours";
import { products } from "../lib/navigation";

test("each tool page has exactly one walkthrough and ids are unique", () => {
  assert.equal(new Set(tours.map((t) => t.id)).size, tours.length);
  for (const path of ["/studio", "/qr-studio", "/stamp-maker", "/email-signature"]) {
    assert.equal(tours.filter((t) => t.match(path)).length, 1, path);
  }
  assert.equal(tourFor("/"), null);
  assert.equal(tourFor("/qr-studio/abc"), null);
});

test("every step has a title and a short, plain explanation", () => {
  for (const t of tours) {
    assert.ok(t.steps.length >= 3 && t.steps.length <= 6, t.id);
    for (const s of t.steps) {
      assert.ok(s.title.length > 0 && s.title.length <= 40, s.title);
      assert.ok(s.body.length > 20 && s.body.length <= 220, s.title);
    }
  }
});

test("every product in the menu points somewhere", () => {
  for (const p of products) assert.match(p.href, /^\/[a-z]/);
});
