import assert from "node:assert/strict";
import test from "node:test";
import { menuPlacement, pastedBareUrl } from "./linkPasteMenu.ts";

test("a pasted http(s) URL on its own is offered the link menu, trimmed", () => {
  assert.equal(pastedBareUrl("  https://example.com/a?b=c \n"), "https://example.com/a?b=c");
  assert.equal(pastedBareUrl("HTTP://EXAMPLE.COM"), "HTTP://EXAMPLE.COM");
});

test("anything but a single http(s) URL pastes natively", () => {
  for (const text of ["", "see https://example.com", "https://example.com and more", "ftp://example.com", "example.com", "https://"]) {
    assert.equal(pastedBareUrl(text), null, text);
  }
});

const viewport = { width: 1000, height: 800 };
const menu = { width: 200, height: 100 };

test("the menu opens just below the caret when it fits", () => {
  assert.deepEqual(menuPlacement({ left: 50, top: 100, bottom: 120 }, menu, viewport), { left: 50, top: 126 });
});

test("the menu flips above the caret when it would run off the bottom", () => {
  assert.deepEqual(menuPlacement({ left: 50, top: 700, bottom: 720 }, menu, viewport), { left: 50, top: 594 });
  assert.deepEqual(menuPlacement({ left: 50, top: 600, bottom: 686 }, menu, viewport), { left: 50, top: 692 });
  assert.deepEqual(menuPlacement({ left: 50, top: 600, bottom: 687 }, menu, viewport), { left: 50, top: 494 });
});

test("the menu stays a margin away from every viewport edge", () => {
  assert.deepEqual(menuPlacement({ left: 950, top: 100, bottom: 120 }, menu, viewport), { left: 792, top: 126 });
  assert.deepEqual(menuPlacement({ left: -20, top: 50, bottom: 790 }, menu, viewport), { left: 8, top: 8 });
});
