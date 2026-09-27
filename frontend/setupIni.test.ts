import { test } from "node:test";
import assert from "node:assert/strict";
import { iniValue, setIniValue } from "./setupIni.ts";

test("settings form preserves both languages and unrelated sections", () => {
  const input = "[general]\nlanguage = da\n[classifications.da]\nservice = Gudstjeneste\n[classifications.en]\nservice = Service\n";
  const changed = setIniValue(input, "general", "language", "en");
  assert.equal(iniValue(changed, "general", "language"), "en");
  assert.ok(changed.endsWith(input.slice(input.indexOf("[classifications.da]"))));
});
test("Nextcloud fields can be added, edited and cleared without touching comments", () => {
  let text = "[nextcloud]\n; base_url = https://example.org\n";
  text = setIniValue(text, "nextcloud", "base_url", "https://cloud.example.org");
  assert.equal(iniValue(text, "nextcloud", "base_url"), "https://cloud.example.org");
  text = setIniValue(text, "nextcloud", "base_url", "");
  assert.equal(iniValue(text, "nextcloud", "base_url"), "");
  assert.ok(text.includes("; base_url = https://example.org"));
  text = setIniValue(text, "service", "start_time", "10:30");
  assert.equal(iniValue(text, "service", "start_time"), "10:30");
});
