import assert from "node:assert/strict";
import test from "node:test";

test("image dialog does not autofocus for a coarse pointer", async () => {
  const mobile = await import("./mobile.ts").catch(() => null);

  assert.ok(mobile, "mobile interaction helpers should exist");
  assert.equal(mobile.shouldAutofocusImageDialog(true), false);
});

test("image dialog keeps autofocus for a precise pointer", async () => {
  const mobile = await import("./mobile.ts").catch(() => null);

  assert.ok(mobile, "mobile interaction helpers should exist");
  assert.equal(mobile.shouldAutofocusImageDialog(false), true);
});
