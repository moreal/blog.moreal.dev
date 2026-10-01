import assert from "node:assert/strict";
import test from "node:test";
import { frontMatterSummary } from "./frontMatterSummary.ts";

test("a regular post is summarized by its publication minute and kind", () => {
  assert.deepEqual(frontMatterSummary({ published: "2026-09-30T21:04:59+09:00" }), [
    "2026-09-30 21:04 발행",
    "일반 글",
  ]);
});

test("flags and the book title join the summary only when set", () => {
  assert.deepEqual(
    frontMatterSummary({
      published: "",
      type: "reading",
      draft: true,
      dark: true,
      book: { title: "토지" },
    }),
    ["발행일 없음", "독후감", "초안", "불 끔", "『토지』"],
  );
});
