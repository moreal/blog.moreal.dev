import assert from "node:assert/strict";
import test from "node:test";
import { activeHeadingIndex, outlineOf, plainHeadingText } from "./outline.ts";

test("setext and ATX headings are listed with their level and starting line", () => {
  const body = ["Title", "=====", "", "Intro", "", "Section", "-------", "", "### Detail ###", "", "#### Too deep"].join("\n");
  assert.deepEqual(outlineOf(body), [
    { level: 1, text: "Title", line: 1 },
    { level: 2, text: "Section", line: 6 },
    { level: 3, text: "Detail", line: 9 },
  ]);
});

test("a setext heading wrapped over two lines is one heading starting on its first line", () => {
  assert.deepEqual(outlineOf("아주 긴\n제목\n==="), [{ level: 1, text: "아주 긴 제목", line: 1 }]);
});

test("a rule after a blank line, and anything inside a code fence, is not a heading", () => {
  const body = ["para", "", "---", "", "```md", "# not a heading", "Nope", "===", "```", "", "## Real"].join("\n");
  assert.deepEqual(outlineOf(body), [{ level: 2, text: "Real", line: 11 }]);
});

test("list items and quotes above a dash line are not turned into headings", () => {
  assert.deepEqual(outlineOf("- item\n---\n\n> quote\n==="), []);
});

test("heading text drops inline markup but keeps what a reader sees", () => {
  assert.equal(plainHeadingText("**굵은** `code`와 [링크](https://example.com)[^1]"), "굵은 code와 링크");
  assert.equal(plainHeadingText("a\\*b"), "a*b");
  assert.equal(plainHeadingText("[ap-thread-reader]"), "ap-thread-reader");
});

test("the active heading is the last one at or above the caret line", () => {
  const headings = outlineOf("# A\n\ntext\n\n## B\n\ntext\n\n## C");
  assert.equal(activeHeadingIndex(headings, 0), 0);
  assert.equal(activeHeadingIndex([], 5), -1);
  assert.equal(activeHeadingIndex(headings, 1), 0);
  assert.equal(activeHeadingIndex(headings, 6), 1);
  assert.equal(activeHeadingIndex(headings, 99), 2);
});
