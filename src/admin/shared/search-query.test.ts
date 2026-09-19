import assert from "node:assert/strict";
import test from "node:test";
import { isSearchableQuery } from "./search-query.ts";

test("a query needs two characters besides surrounding whitespace before post bodies are searched", () => {
  assert.equal(isSearchableQuery(""), false);
  assert.equal(isSearchableQuery(" a "), false);
  assert.equal(isSearchableQuery("ab"), true);
  assert.equal(isSearchableQuery(" 개발 "), true);
});
