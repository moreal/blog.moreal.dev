import assert from "node:assert/strict";
import test from "node:test";
import { formatterWarningOf, savedStatus, type SavedPost } from "./saveOutcome.ts";

function saved(overrides: Partial<SavedPost> = {}): SavedPost {
  return { ok: true, file: "a.md", fenceRaw: "", body: "", mtimeMs: 0, formatted: true, ...overrides };
}

test("the status says whether hongdown formatted the saved file", () => {
  assert.equal(savedStatus(saved()), "저장됨 · hongdown 적용");
  assert.equal(savedStatus(saved({ formatted: false })), "저장됨");
});

test("a formatter warning is shown as is, and takes precedence over lint notices", () => {
  assert.equal(formatterWarningOf(saved({ formatterWarning: "not found", formatterNotices: "lint" })), "not found");
});

test("lint notices are shown as coming from hongdown, and a clean format shows nothing", () => {
  assert.equal(formatterWarningOf(saved({ formatterNotices: "line 3: long" })), "hongdown: line 3: long");
  assert.equal(formatterWarningOf(saved()), undefined);
});
