import { test } from "node:test";
import assert from "node:assert/strict";
import { previewStatistics } from "./previewStatistics.ts";

const point = (second: number, levelDb: number, deviceId = "test") => ({
  timestamp: new Date(Date.UTC(2026, 8, 27) + second * 1000).toISOString(),
  levelDb, deviceId, weighting: null, response: null, raw: "",
});
test("demo matches Rust energy integration and crossings fixture", () => {
  const stats = previewStatistics([point(0,80), point(1,100), point(3,100)]);
  assert.ok(Math.abs(stats.leqDb! - 10 * Math.log10(((1e8 + 1e10) / 2 + 2e10) / 3)) < 1e-8);
  assert.equal(stats.redZoneSeconds, 2.5);
  assert.equal(stats.minimumDb, 80); assert.equal(stats.maximumDb, 100);
});
test("demo retains whole session beyond graph window and excludes gaps/devices", () => {
  const stats = previewStatistics(Array.from({length:1000}, (_,i) => point(i, i === 0 ? 110 : 70)));
  assert.equal(stats.sampleCount, 1000); assert.equal(stats.maximumDb, 110);
  assert.equal(stats.observedSeconds, 999); assert.equal(stats.redZoneSeconds, 0.5);
  assert.equal(previewStatistics([point(0,95),point(20,95)]).redZoneSeconds,0);
  assert.equal(previewStatistics([point(0,95),point(1,95,"other")]).redZoneSeconds,0);
});
