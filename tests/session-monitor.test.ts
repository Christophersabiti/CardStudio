import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createSessionMonitor,
  SESSION_WARNING_SECONDS,
} from "../lib/session-monitor";

test("background checks do not invalidate the current session while pending", async () => {
  let finish!: (value: {
    status: number;
    active: boolean;
    remaining: number;
  }) => void;
  const events: string[] = [];
  const monitor = createSessionMonitor({
    request: () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
    now: () => 1000,
    onVerified: () => events.push("verified"),
    onUnavailable: () => events.push("unavailable"),
    onExpired: () => events.push("expired"),
  });
  const initial = monitor.check();
  assert.deepEqual(events, []);
  finish({ status: 200, active: true, remaining: 900 });
  await initial;
  const resume = monitor.check();
  assert.deepEqual(events, ["verified"]);
  finish({ status: 200, active: true, remaining: 850 });
  await resume;
  assert.deepEqual(events, ["verified", "verified"]);
});
test("activity during a background check is renewed afterwards without parallel requests", async () => {
  const calls: boolean[] = [],
    deadlines: number[] = [];
  let resolve!: (value: {
    status: number;
    active: boolean;
    remaining: number;
  }) => void;
  let clock = 0;
  const monitor = createSessionMonitor({
    request: (touch) => {
      calls.push(touch);
      return new Promise((r) => {
        resolve = r;
      });
    },
    now: () => clock,
    onVerified: (d) => deadlines.push(d),
    onUnavailable: () => assert.fail(),
    onExpired: () => assert.fail(),
  });
  const check = monitor.check();
  void monitor.check(true);
  void monitor.check(true);
  assert.deepEqual(calls, [false]);
  resolve({ status: 200, active: true, remaining: 100 });
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, [false, true]);
  clock = 1000;
  resolve({ status: 200, active: true, remaining: 900 });
  await check;
  assert.deepEqual(deadlines, [100000, 900000]);
});
test("revocation logs out but temporary network failures only disable protected operations", async () => {
  const events: string[] = [];
  let status = 503;
  const monitor = createSessionMonitor({
    request: async () => ({ status }),
    onVerified: () => events.push("verified"),
    onUnavailable: () => events.push("unavailable"),
    onExpired: () => events.push("expired"),
  });
  await monitor.check();
  assert.deepEqual(events, ["unavailable"]);
  status = 401;
  await monitor.check();
  await monitor.check();
  assert.deepEqual(events, ["unavailable", "expired"]);
});
test("late responses after teardown cannot change session state", async () => {
  let finish!: (v: {
    status: number;
    active: boolean;
    remaining: number;
  }) => void;
  const monitor = createSessionMonitor({
    request: () =>
      new Promise((r) => {
        finish = r;
      }),
    onVerified: () => assert.fail(),
    onUnavailable: () => assert.fail(),
    onExpired: () => assert.fail(),
  });
  const check = monitor.check();
  monitor.stop();
  finish({ status: 200, active: true, remaining: 900 });
  await check;
});
test("cross-tab renewal cannot be shortened by an older check and warning starts at two minutes", async () => {
  const deadlines: number[] = [];
  const monitor = createSessionMonitor({
    request: async () => ({ status: 200, active: true, remaining: 100 }),
    now: () => 0,
    onVerified: (d) => deadlines.push(d),
    onUnavailable: () => assert.fail(),
    onExpired: () => assert.fail(),
  });
  monitor.acceptDeadline(800000);
  await monitor.check();
  assert.deepEqual(deadlines, [800000, 800000]);
  assert.equal(SESSION_WARNING_SECONDS, 120);
});
