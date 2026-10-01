import assert from "node:assert/strict";
import test from "node:test";
import { MIN_THUMB, scrollTopAfterDrag, thumbOf } from "./scrollbarGeometry.ts";

test("content that fits needs no thumb", () => {
  assert.equal(thumbOf({ scrollTop: 0, scrollHeight: 800, clientHeight: 800 }, 800), null);
  assert.equal(thumbOf({ scrollTop: 0, scrollHeight: 900, clientHeight: 800 }, 0), null);
});

test("the thumb is as long as the visible share of the content and travels the rest of the track", () => {
  const metrics = { scrollHeight: 2000, clientHeight: 500 };
  assert.deepEqual(thumbOf({ ...metrics, scrollTop: 0 }, 400), { size: 100, offset: 0 });
  assert.deepEqual(thumbOf({ ...metrics, scrollTop: 750 }, 400), { size: 100, offset: 150 });
  assert.deepEqual(thumbOf({ ...metrics, scrollTop: 1500 }, 400), { size: 100, offset: 300 });
});

test("a very long document still gets a thumb that can be grabbed", () => {
  const thumb = thumbOf({ scrollTop: 0, scrollHeight: 1_000_000, clientHeight: 500 }, 400);
  assert.equal(thumb?.size, MIN_THUMB);
});

test("dragging the thumb moves the content proportionally and stops at both ends", () => {
  const metrics = { scrollTop: 0, scrollHeight: 2000, clientHeight: 500 };
  assert.equal(scrollTopAfterDrag(150, 0, metrics, 400), 750);
  assert.equal(scrollTopAfterDrag(-50, 0, metrics, 400), 0);
  assert.equal(scrollTopAfterDrag(9999, 0, metrics, 400), 1500);
});
