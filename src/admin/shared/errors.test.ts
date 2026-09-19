import assert from "node:assert/strict";
import test from "node:test";
import { errorMessage } from "./errors.ts";

test("an Error is described by its message", () => {
  assert.equal(errorMessage(new TypeError("broken")), "broken");
});

test("anything else thrown is described by its string form", () => {
  assert.equal(errorMessage("plain text"), "plain text");
  assert.equal(errorMessage(404), "404");
  assert.equal(errorMessage(null), "null");
});
