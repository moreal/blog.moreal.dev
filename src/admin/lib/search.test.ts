import assert from "node:assert/strict";
import test from "node:test";
import { findSourceMatches } from "./search.ts";

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
