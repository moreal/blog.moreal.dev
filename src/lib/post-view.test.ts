import assert from "node:assert/strict";
import test from "node:test";
import { backLinkHref, bookLine, descriptionOf, primaryLanguage } from "./post-view.ts";
import type { PostView } from "./posts.ts";

function view(overrides: Partial<PostView> = {}): PostView {
  return {
    lang: "ko-Hang", html: "", title: "제목",
    published: new Date("2026-03-01T01:00:00Z"), draft: false, dark: false,
    ...overrides,
  };
}

test("a page declares the primary language of its view's tag", () => {
  assert.equal(primaryLanguage("ko-Kore"), "ko");
  assert.equal(primaryLanguage("en"), "en");
});

test("a view without a description is described generically", () => {
  assert.equal(descriptionOf(view({ description: "요약" })), "요약");
  assert.equal(descriptionOf(view()), "블로그 포스트");
  assert.equal(descriptionOf(view({ description: "" })), "블로그 포스트");
});

test("a daily note leads back to the daily tab, since the main list leaves it out", () => {
  assert.equal(backLinkHref(view({ type: "daily" })), "/daily/");
  assert.equal(backLinkHref(view({ type: "reading" })), "/");
  assert.equal(backLinkHref(view()), "/");
});

test("the book line lists author, translator, publisher and year, skipping what is missing", () => {
  assert.equal(
    bookLine({ title: "t", author: "한강", translator: "데버라 스미스", publisher: "창비", year: 2014 }),
    "한강 · 데버라 스미스 옮김 · 창비 · 2014",
  );
  assert.equal(bookLine({ author: "한강", year: 2014 }), "한강 · 2014");
  assert.equal(bookLine({ title: "t" }), "");
  assert.equal(bookLine({ translator: "" }), "");
});
