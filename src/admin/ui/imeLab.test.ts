import assert from "node:assert/strict";
import test from "node:test";
import { codepoints, eventDetail, eventRowClass } from "./imeLabEvents.ts";
import { formatImeReport } from "./imeLabReport.ts";
import type { LogEntry } from "./imeLabModel.ts";

function entry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    seq: 1,
    t: 0,
    pane: "textarea",
    source: "capture",
    type: "input",
    detail: {},
    value: "한자",
    ...overrides,
  };
}

test("IME diagnostics distinguish Hanja code points, including supplementary characters", () => {
  assert.deepEqual(codepoints("한漢𠀀A"), [
    { cp: "U+D55C", hanja: false },
    { cp: "U+6F22", hanja: true },
    { cp: "U+20000", hanja: true },
    { cp: "U+0041", hanja: false },
  ]);
  assert.equal(codepoints("𠀀".repeat(61)).length, 60);
});

test("replacement highlighting takes precedence over composition and key events", () => {
  assert.equal(eventRowClass(entry({
    type: "compositionupdate",
    detail: { inputType: "insertReplacementText" },
  })), "is-replacement");
  assert.equal(eventRowClass(entry({
    type: "keydown",
    detail: { targetRanges: [{ collapsed: false }] },
  })), "is-replacement");
  assert.equal(eventRowClass(entry({ type: "compositionend" })), "is-composition");
  assert.equal(eventRowClass(entry({ type: "keyup" })), "is-key");
  assert.equal(eventRowClass(entry({ detail: { targetRanges: [{ collapsed: true }] } })), undefined);
});

test("keyboard event inspection retains the IME keyCode signal", () => {
  const keyboard = {
    key: "Enter", code: "Enter", keyCode: 229,
    altKey: true, ctrlKey: false, metaKey: false, shiftKey: false,
    isComposing: true, repeat: false,
  };
  assert.deepEqual(eventDetail("keydown", keyboard as KeyboardEvent), keyboard);
});

test("reports include all panes, verdicts, and an explicit unobserved sequence", () => {
  const report = formatImeReport([], { "textarea:0": true }, "test-browser");
  assert.ok(report.includes("- 브라우저: test-browser\n- 이벤트 수: 0"));
  assert.ok(report.includes("| textarea | ✅ | ❌ | ❌ | ❌ |"));
  assert.ok(report.includes("| CodeMirror 6 | ❌ | ❌ | ❌ | ❌ |"));
  assert.equal(report.split("(⌥⏎ 관측 안 됨)").length - 1, 4);
});

test("reports deduplicate input types and preserve the last Alt-key sequence and final value", () => {
  const log = [
    entry({ type: "keydown", detail: { altKey: true, key: "Enter" } }),
    entry({ detail: { inputType: "insertText" } }),
    entry({ pane: "codemirror", detail: { inputType: "insertText" } }),
    entry({ type: "keydown", detail: { altKey: true, key: "Alt" } }),
    ...Array.from({ length: 35 }, (_, index) => entry({
      detail: { inputType: "insertText", index },
      value: index === 34 ? "漢字" : "한자",
    })),
  ];
  const report = formatImeReport(log, {}, "browser");
  const sequence = report.split("**textarea**\n\n")[1]!.split("**contenteditable**")[0]!;
  assert.ok(report.includes("- **textarea**: insertText\n"));
  assert.ok(sequence.startsWith('~~~~\nkeydown {"altKey":true,"key":"Alt"}'));
  assert.equal(sequence.split("\ninput ").length - 1, 29);
  assert.ok(sequence.includes("최종 값: `漢字`"));
});
