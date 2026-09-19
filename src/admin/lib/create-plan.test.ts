import assert from "node:assert/strict";
import test from "node:test";
import { planNewPost, planTranslation } from "./create-plan.ts";

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
