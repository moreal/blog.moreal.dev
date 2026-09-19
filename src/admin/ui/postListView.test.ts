import assert from "node:assert/strict";
import test from "node:test";
import type { PostGroup, PostSourceSummary } from "../lib/types.ts";
import {
  firstListedPublished,
  groupsByPublishedYear,
  matchesFilter,
  matchesQuery,
  sourceCount,
} from "./postListView.ts";

function source(overrides: Partial<PostSourceSummary> = {}): PostSourceSummary {
  return {
    file: "2026/02/post.ko-Hang.md", postPath: "2026/02/post", year: "2026", month: "02", slug: "post",
    lang: "ko-Hang", title: "제목", published: "2026-02-01T10:00:00+09:00", publishedMs: 0,
    draft: false, dark: false, derivedLangs: [], bytes: 0, mtimeMs: 0,
    ...overrides,
  };
}

function group(postPath: string, sources: PostSourceSummary[], assetDir: string | null = null): PostGroup {
  return { postPath, year: "", month: "", slug: "", sources, missingLangs: [], assetDir, assetCount: 0 };
}

test("every post passes the 'all' filter", () => {
  assert.equal(matchesFilter(group("a", [source()]), "all"), true);
});

test("a post passes a type or draft filter when any of its sources does", () => {
  const post = group("a", [source(), source({ type: "reading", draft: true })]);
  assert.equal(matchesFilter(post, "reading"), true);
  assert.equal(matchesFilter(post, "draft"), true);
  assert.equal(matchesFilter(post, "daily"), false);
  assert.equal(matchesFilter(group("b", [source()]), "draft"), false);
});

test("a post passes the image filter only when it has an asset directory", () => {
  assert.equal(matchesFilter(group("a", [source()], "a"), "asset"), true);
  assert.equal(matchesFilter(group("a", [source()]), "asset"), false);
});

test("the list query matches the post path and each source's title, description and language", () => {
  const post = group("2026/02/career", [source({ title: "Career", description: "Jobs", lang: "en" })]);
  for (const query of ["", "2026/02", "career", "jobs", "en"]) assert.equal(matchesQuery(post, query), true, query);
  assert.equal(matchesQuery(post, "ko-hang"), false);
});

test("posts are grouped under the Seoul year of their first source, newest year first", () => {
  const newYear = group("n", [source({ published: "2025-12-31T15:00:00Z" })]);
  const lastYear = group("l", [source({ published: "2025-12-31T14:59:00Z" })]);
  const alsoNewYear = group("m", [source({ published: "2026-05-01T00:00:00+09:00" })]);
  assert.deepEqual(groupsByPublishedYear([lastYear, newYear, alsoNewYear]), [
    ["2026", [newYear, alsoNewYear]],
    ["2025", [lastYear]],
  ]);
});

test("a post is dated by its first listed source", () => {
  assert.equal(firstListedPublished(group("a", [source({ published: "x" }), source({ published: "y" })])), "x");
  assert.equal(firstListedPublished(group("a", [])), "");
});

test("the source count adds up every language of every post", () => {
  assert.equal(sourceCount([group("a", [source(), source()]), group("b", [source()])]), 3);
});
