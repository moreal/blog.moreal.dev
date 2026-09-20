import assert from "node:assert/strict";
import test from "node:test";
import {
  type CreateRequest,
  parseTranslationSource,
  planCreation,
  planNewPost,
  planTranslation,
  postFileOf,
  unknownLangOrKindMessage,
} from "./create-plan.ts";

const request = { kind: "regular", lang: "en", slug: "a-post", date: "2024-02-29" } as const;

test("new posts use the requested calendar day for location and publication", () => {
  const result = planNewPost(request);
  assert.ok(result.ok);
  assert.equal(result.plan.year, "2024");
  assert.equal(result.plan.month, "02");
  assert.equal(result.plan.slug, "a-post");
  assert.match(result.plan.input.publishedAt!, /^2024-02-29T.*\+09:00$/);
  const daily = planNewPost({ ...request, kind: "daily", slug: "INVALID" });
  assert.ok(daily.ok);
  assert.equal(daily.plan.slug, "2024-02-29");
});

test("date validation precedes slug validation and rejects impossible days", () => {
  assert.deepEqual(planNewPost({ ...request, date: "2023-02-29", slug: "INVALID" }), {
    ok: false, error: "bad-request", message: "날짜는 실제로 있는 YYYY-MM-DD 여야 합니다.",
  });
  assert.deepEqual(planNewPost({ ...request, slug: "INVALID" }), {
    ok: false, error: "bad-name", message: "슬러그는 영소문자·숫자·하이픈만 쓸 수 있습니다.",
  });
});

test("translation inherits location, publication, kind, dark and book while retaining request description", () => {
  const book = { title: "Original book", author: "Author" };
  const result = planTranslation({ ...request, title: "Translation", dark: false, description: "New description" }, "2020/03/original", {
    form: { published: "2020-03-01T10:00:00+09:00", type: "reading", dark: true, book }, heading: "Original title",
  });
  assert.ok(result.ok);
  assert.deepEqual([result.plan.year, result.plan.month, result.plan.slug], ["2020", "03", "original"]);
  assert.equal(result.plan.input.kind, "reading");
  assert.equal(result.plan.input.publishedAt, "2020-03-01T10:00:00+09:00");
  assert.equal(result.plan.input.title, "Translation");
  assert.equal(result.plan.input.description, "New description");
  assert.equal(result.plan.input.dark, true);
  assert.deepEqual(result.plan.input.book, book);
});

test("translation defaults missing original kind and title, retaining request flags when not inherited", () => {
  const original = { form: { published: "2020-03-01T10:00:00+09:00", dark: false }, heading: "Original title" };
  const inherited = planTranslation({ ...request, kind: "daily", dark: true }, "2020/03/original", original);
  assert.ok(inherited.ok);
  assert.equal(inherited.plan.input.kind, "regular");
  assert.equal(inherited.plan.input.title, "Original title");
  assert.equal(inherited.plan.input.dark, true);
  const empty = planTranslation({ ...request, title: "" }, "2020/03/original", original);
  assert.ok(empty.ok);
  assert.equal(empty.plan.input.title, "");
  assert.deepEqual(planTranslation(request, "2020/03/original", null), {
    ok: false, error: "not-found", message: "2020/03/original 에 원본이 없습니다.",
  });
});

test("a new post without a date is published at the current Seoul time, and a backdated one keeps that clock", () => {
  const newYearInSeoul = new Date("2025-12-31T15:00:00Z");
  for (const date of [undefined, ""]) {
    const result = planNewPost({ ...request, date }, newYearInSeoul);
    assert.ok(result.ok);
    assert.deepEqual([result.plan.year, result.plan.month], ["2026", "01"]);
    assert.equal(result.plan.input.publishedAt, "2026-01-01T00:00:00+09:00");
  }
  const daily = planNewPost({ kind: "daily", lang: "en" }, newYearInSeoul);
  assert.ok(daily.ok);
  assert.equal(daily.plan.slug, "2026-01-01");
  const backdated = planNewPost(request, new Date("2026-09-08T01:23:45Z"));
  assert.ok(backdated.ok);
  assert.equal(backdated.plan.input.publishedAt, "2024-02-29T10:23:45+09:00");
});

test("a translation source is the original's front matter and its first heading", () => {
  const original = "---\npublished: 2020-03-01T10:00:00+09:00\ntype: reading\ndark: true\n---\n\n  Original title  \n==============\n\nText\n";
  assert.deepEqual(parseTranslationSource(original, "original.en.md"), {
    form: { published: "2020-03-01T10:00:00+09:00", type: "reading", dark: true },
    heading: "Original title",
  });
  const untitled = parseTranslationSource("---\npublished: 2020-03-01T10:00:00+09:00\n---\n\n", "original.en.md");
  assert.equal(untitled.heading, "");
});

test("a translation takes the heading's text, not the line that spells it", () => {
  const fence = "---\npublished: 2020-03-01T10:00:00+09:00\n---\n";
  const headingOf = (body: string) => parseTranslationSource(fence + body, "original.en.md").heading;
  assert.equal(headingOf("\n# Real title\n\nText\n"), "Real title");
  assert.equal(headingOf("#   Real title   ###\n"), "Real title");
  assert.equal(headingOf("\n# *Real* `title`\n"), "Real title");
  assert.equal(headingOf("\nReal title\n==========\n\nText\n"), "Real title");
  const plan = planTranslation({ ...request, title: undefined }, "2020/03/original", {
    form: { published: "2020-03-01T10:00:00+09:00" },
    heading: headingOf("# Real title\n"),
  });
  assert.ok(plan.ok);
  assert.equal(plan.plan.input.title, "Real title");
});

test("a request names one of the known languages and kinds, and the language is checked first", () => {
  assert.equal(unknownLangOrKindMessage(request), null);
  assert.equal(unknownLangOrKindMessage({ ...request, kind: "daily", lang: "ko-Kore" }), null);
  const unknownLang = { ...request, lang: "fr" } as unknown as CreateRequest;
  assert.equal(unknownLangOrKindMessage(unknownLang), 'unknown language "fr"');
  const unknownKind = { ...request, kind: "poem" } as unknown as CreateRequest;
  assert.equal(unknownLangOrKindMessage(unknownKind), 'unknown kind "poem"');
  const unknownBoth = { ...request, lang: "fr", kind: "poem" } as unknown as CreateRequest;
  assert.equal(unknownLangOrKindMessage(unknownBoth), 'unknown language "fr"');
  assert.equal(unknownLangOrKindMessage({} as CreateRequest), "unknown language undefined");
});

test("a request without an original to translate plans a new post", async () => {
  const now = new Date("2026-09-08T01:23:45Z");
  for (const translationOf of [undefined, ""]) {
    assert.deepEqual(await planCreation({ ...request, translationOf }, now), planNewPost({ ...request, translationOf }, now));
  }
});

test("a request naming an original plans its translation from the original on disk", async () => {
  assert.deepEqual(await planCreation({ ...request, translationOf: "2000/01/no-such-post" }), {
    ok: false, error: "not-found", message: "2000/01/no-such-post 에 원본이 없습니다.",
  });
  await assert.rejects(planCreation({ ...request, translationOf: "../outside" }), { message: "path is not repo-relative" });
});

test("a planned post is written as its slug and language under its year and month", () => {
  const newPost = planNewPost(request);
  assert.ok(newPost.ok);
  assert.equal(postFileOf(newPost.plan), "2024/02/a-post.en.md");
  const translation = planTranslation({ ...request, lang: "ko-Kore" }, "2020/03/original", {
    form: { published: "2020-03-01T10:00:00+09:00" }, heading: "",
  });
  assert.ok(translation.ok);
  assert.equal(postFileOf(translation.plan), "2020/03/original.ko-Kore.md");
});
