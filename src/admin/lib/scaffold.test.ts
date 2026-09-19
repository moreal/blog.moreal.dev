import assert from "node:assert/strict";
import test from "node:test";
import { scaffold } from "./scaffold.ts";

const publishedAt = "2026-09-20T10:00:00+09:00";

test("the title underline counts each non-ASCII character as two columns", () => {
  const { source } = scaffold({ kind: "regular", lang: "ko-Hang", title: "Hi 한글!", publishedAt });
  assert.equal(source, `---\npublished: ${publishedAt}\n---\n\nHi 한글!\n========\n`);
});

test("a supplementary-plane character is one character in the underline, not two code units", () => {
  const { source } = scaffold({ kind: "regular", lang: "ko-Kore", title: "𠀀", publishedAt });
  assert.equal(source.split("\n").at(-2), "==");
});
