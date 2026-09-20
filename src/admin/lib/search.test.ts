import assert from "node:assert/strict";
import test from "node:test";
import { findSourceMatches, searchSources } from "./search.ts";
import type { PostGroup } from "./types.ts";

test("search includes metadata and counts matching lines rather than occurrences", () => {
  assert.deepEqual(
    findSourceMatches('---\ndescription: CMS\n---\n\nCMS cms\nend', 'cms'),
    { line: 2, excerpt: 'description: CMS', count: 2 },
  );
  assert.equal(findSourceMatches("unrelated text", "cms"), null);
});

test("long excerpts retain context and mark truncation at both ends", () => {
  assert.deepEqual(
    findSourceMatches("a".repeat(60) + "CMS" + "b".repeat(60), "cms"),
    { line: 1, excerpt: "…" + "a".repeat(48) + "CMS" + "b".repeat(48) + "…", count: 1 },
  );
});

function group(postPath: string, sources: { file: string; title?: string; lang?: "ko-Hang" | "en" }[]): PostGroup {
  const [year = "", month = "", slug = ""] = postPath.split("/");
  return {
    postPath, year, month, slug,
    missingLangs: [], assetDir: null, assetCount: 0,
    sources: sources.map(({ file, title = "", lang = "ko-Hang" }) => ({
      file, postPath, year, month, slug, lang, title,
      published: "", publishedMs: 0, draft: false, dark: false,
      derivedLangs: [], bytes: 0, mtimeMs: 0,
    })),
  };
}

function reader(texts: Record<string, string>) {
  return async (file: string) => texts[file] ?? null;
}

test("search hits carry where they were found and list the most matching lines first", async () => {
  const groups = [
    group("2026/01/one", [{ file: "2026/01/one.ko-Hang.md", title: "첫 글" }]),
    group("2026/02/two", [{ file: "2026/02/two.en.md", lang: "en" }]),
  ];
  const found = await searchSources(groups, "cms", reader({
    "2026/01/one.ko-Hang.md": "CMS\nother",
    "2026/02/two.en.md": "cms\nCMS again",
  }));
  assert.deepEqual(found, {
    truncated: false,
    hits: [
      { file: "2026/02/two.en.md", postPath: "2026/02/two", lang: "en", title: "two", line: 1, excerpt: "cms", count: 2 },
      { file: "2026/01/one.ko-Hang.md", postPath: "2026/01/one", lang: "ko-Hang", title: "첫 글", line: 1, excerpt: "CMS", count: 1 },
    ],
  });
});

test("sources that cannot be read or do not match are skipped", async () => {
  const groups = [group("2026/01/one", [{ file: "a.md" }, { file: "b.md" }, { file: "c.md" }])];
  const found = await searchSources(groups, "cms", reader({ "b.md": "nothing", "c.md": "cms" }));
  assert.deepEqual(found.hits.map((hit) => hit.file), ["c.md"]);
});

test("the posts with the most matching lines are the ones kept when the list is cut short", async () => {
  const files = ["a.md", "b.md", "c.md"];
  const groups = [group("2026/01/one", files.map((file) => ({ file })))];
  const found = await searchSources(groups, "cms", reader({
    "a.md": "cms",
    "b.md": "cms",
    "c.md": "cms\ncms\ncms",
  }), 2);
  assert.deepEqual(found.hits.map((hit) => [hit.file, hit.count]), [["c.md", 3], ["a.md", 1]]);
  assert.equal(found.truncated, true);
});

test("search cuts the ranked list at the hit limit and says the list was cut short", async () => {
  const files = ["a.md", "b.md", "c.md"];
  const groups = [group("2026/01/one", files.map((file) => ({ file })))];
  const texts = Object.fromEntries(files.map((file) => [file, "cms"]));
  assert.deepEqual(await searchSources(groups, "cms", reader(texts), 3).then((f) => f.truncated), false);
  const cut = await searchSources(groups, "cms", reader(texts), 2);
  assert.equal(cut.truncated, true);
  assert.deepEqual(cut.hits.map((hit) => hit.file), ["a.md", "b.md"]);
});
