import assert from "node:assert/strict";
import test from "node:test";
import { blockInsertion, findLine, fingerprintOf } from "./engine.ts";

test("a pasted block at the start of a line is followed by a blank line", () => {
  assert.equal(blockInsertion("", "![](./a.png)"), "![](./a.png)\n\n");
  assert.equal(blockInsertion("Paragraph\n", "![](./a.png)"), "![](./a.png)\n\n");
  assert.equal(blockInsertion("Paragraph\n   ", "![](./a.png)"), "![](./a.png)\n\n");
});

test("a block pasted after text on the same line is set apart by a blank line on both sides", () => {
  assert.equal(blockInsertion("Some text", "![](./a.png)"), "\n\n![](./a.png)\n\n");
  assert.equal(blockInsertion("Line\nMore text ", "![](./a.png)"), "\n\n![](./a.png)\n\n");
});

test("a line's fingerprint ignores whitespace and keeps its first 24 characters", () => {
  assert.equal(fingerprintOf("  a b\tc  "), "abc");
  assert.equal(fingerprintOf("x".repeat(30)), "x".repeat(24));
});

test("the caret returns to the nearest line that still starts the same way", () => {
  const lines = ["Title", "=====", "", "rewrapped paragraph", "second"];
  assert.equal(findLine(lines, { line: 2, fingerprint: fingerprintOf("second") }), 5);
  assert.equal(findLine(lines, { line: 5, fingerprint: fingerprintOf("Title") }), 1);
});

test("without a match, or on a blank line, the caret keeps its line number within the document", () => {
  const lines = ["a", "b"];
  assert.equal(findLine(lines, { line: 2, fingerprint: "zzz" }), 2);
  assert.equal(findLine(lines, { line: 9, fingerprint: "" }), 2);
});
