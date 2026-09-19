import assert from "node:assert/strict";
import test from "node:test";
import { languageLabel } from "./site.ts";

test("each supported language tag is labelled in that language", () => {
  assert.equal(languageLabel("ko-Hang"), "한국어");
  assert.equal(languageLabel("ko-Kore"), "國漢文");
  assert.equal(languageLabel("en"), "English");
});

test("an unknown language tag is shown as the tag itself", () => {
  assert.equal(languageLabel("ja"), "ja");
});
