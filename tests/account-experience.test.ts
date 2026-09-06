import test from "node:test";
import assert from "node:assert/strict";
import { cardSchema } from "../lib/validation";
import { emptyCard } from "../lib/types";
import { upgradeOptions } from "../lib/billing/upgrade";
import type { Plan } from "../lib/billing/catalog";
const free: Plan = {
  id: "f",
  code: "free",
  name: "Free",
  version: 1,
  enabled: true,
  active_cards: 5,
  active_groups: 1,
  active_qr_codes: 1,
  monthly_cards: 10,
  monthly_qr_codes: 5,
  storage_bytes: 100,
};
const basic: Plan = {
  ...free,
  id: "b",
  code: "basic",
  active_cards: 10,
  monthly_cards: 20,
};
test("orientation supports legacy content and survives validation without accepting invalid values", () => {
  const card = { ...emptyCard(), firstName: "Test" };
  assert.equal(
    cardSchema.parse({ ...card, orientation: "portrait" }).orientation,
    "portrait",
  );
  const { orientation, ...legacy } = card;
  assert.equal(orientation, "landscape");
  assert.equal(cardSchema.parse(legacy).orientation, undefined);
  assert.equal(
    cardSchema.safeParse({ ...card, orientation: "sideways" }).success,
    false,
  );
});
test("upgrade prompts honor exact thresholds, destination configuration and capacity", () => {
  assert.equal(
    upgradeOptions(free, [basic], { active_cards: 3 }, ["basic"], 80).nearing
      .length,
    0,
  );
  assert.deepEqual(
    upgradeOptions(free, [basic], { active_cards: 4 }, ["basic"], 80).nearing,
    ["active_cards"],
  );
  assert.equal(
    upgradeOptions(free, [basic], { active_cards: 5 }, ["basic"], 80).higher
      .length,
    1,
  );
  assert.equal(
    upgradeOptions(free, [basic], { active_cards: 5 }, [], 80).higher.length,
    0,
  );
  assert.equal(
    upgradeOptions(
      free,
      [{ ...basic, storage_bytes: 50 }],
      { active_cards: 5 },
      ["basic"],
      80,
    ).higher.length,
    0,
  );
  assert.equal(
    upgradeOptions(free, [basic], { storage_bytes: 100 }, ["basic"], 80).higher
      .length,
    0,
  );
});
