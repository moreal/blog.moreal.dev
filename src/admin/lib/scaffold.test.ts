import assert from "node:assert/strict";
import test from "node:test";
import { scaffoldSource } from "./scaffold.ts";

const publishedAt = "2026-09-20T10:00:00+09:00";

test("the title underline counts each non-ASCII character as two columns", () => {
  const source = scaffoldSource({ kind: "regular", lang: "ko-Hang", title: "Hi 한글!", publishedAt });
  assert.equal(source, `---\npublished: ${publishedAt}\n---\n\nHi 한글!\n========\n`);
});

test("a supplementary-plane character is one character in the underline, not two code units", () => {
  const source = scaffoldSource({ kind: "regular", lang: "ko-Kore", title: "𠀀", publishedAt });
  assert.equal(source.split("\n").at(-2), "==");
});

test("the heading is written setext-style, as hongdown formats it, so the file is well-formed without the formatter", () => {
  const source = scaffoldSource({ kind: "regular", lang: "en", title: "Hello", publishedAt });
  assert.ok(source.endsWith("\nHello\n=====\n"));
  assert.ok(!source.includes("# Hello"));
});

test("a regular post without a title is headed TODO", () => {
  const source = scaffoldSource({ kind: "regular", lang: "en", publishedAt });
  assert.equal(source, `---\npublished: ${publishedAt}\n---\n\nTODO\n====\n`);
});

test("a daily note is titled with its date, month and day unpadded, like scripts/new-daily.sh", () => {
  const earlyInMonth = "2026-09-05T08:00:00+09:00";
  const titleIn = (lang: "ko-Hang" | "ko-Kore" | "en") =>
    scaffoldSource({ kind: "daily", lang, publishedAt: earlyInMonth }).split("\n").at(-3);
  assert.equal(titleIn("ko-Hang"), "2026년 9월 5일");
  assert.equal(titleIn("ko-Kore"), "2026年 9月 5日");
  assert.equal(titleIn("en"), "2026-09-05");
});

test("a daily note ignores the requested title and is typed daily", () => {
  const source = scaffoldSource({ kind: "daily", lang: "en", title: "Ignored", publishedAt });
  assert.equal(source, `---\npublished: ${publishedAt}\ntype: daily\n---\n\n2026-09-20\n==========\n`);
});

test("a reading post without book details gets the empty title and author lines scripts/new-reading.sh writes", () => {
  const source = scaffoldSource({ kind: "reading", lang: "ko-Hang", title: "책", publishedAt });
  assert.equal(
    source,
    `---\npublished: ${publishedAt}\ntype: reading\nbook:\n  title:\n  author:\n---\n\n책\n==\n`,
  );
});

test("a reading post with book details writes only the given fields", () => {
  const source = scaffoldSource({
    kind: "reading",
    lang: "ko-Hang",
    title: "책",
    publishedAt,
    book: { title: "모모", author: "미하엘 엔데" },
  });
  assert.ok(source.startsWith(`---\npublished: ${publishedAt}\ntype: reading\nbook:\n  title: 모모\n  author: 미하엘 엔데\n---\n`));
});

test("description, draft and dark are written only when set", () => {
  const withAll = scaffoldSource({
    kind: "regular",
    lang: "en",
    title: "T",
    publishedAt,
    description: "About it",
    draft: true,
    dark: true,
  });
  assert.ok(withAll.startsWith(`---\npublished: ${publishedAt}\ndescription: About it\ndraft: true\ndark: true\n---\n`));

  const withNone = scaffoldSource({
    kind: "regular",
    lang: "en",
    title: "T",
    publishedAt,
    description: "",
    draft: false,
    dark: false,
  });
  assert.ok(withNone.startsWith(`---\npublished: ${publishedAt}\n---\n`));
});
