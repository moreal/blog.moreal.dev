import assert from "node:assert/strict";
import test from "node:test";
import { RECENT_BUFFERS_KEPT, recentlyUsedCache, renderBuffer } from "./render.ts";

let bufferCount = 0;

function freshBuffer(): string {
  bufferCount += 1;
  return `---\npublished: 2026-03-01T10:00:00+09:00\n---\n\n# Buffer ${bufferCount}\n\nBody\n`;
}

test("a buffer renders through the published pages' pipeline", () => {
  const [view] = renderBuffer(
    "---\npublished: 2026-03-01T10:00:00+09:00\n---\n\n# 제목\n\n본문\n",
    "en",
  );
  assert.equal(view?.lang, "en");
  assert.equal(view?.title, "제목");
  assert.match(view?.html ?? "", /<p>본문<\/p>/);
});

test("an unchanged buffer is served without rendering it again", () => {
  const buffer = freshBuffer();
  assert.equal(renderBuffer(buffer, "en"), renderBuffer(buffer, "en"));
});

test("the same buffer in another language is rendered separately", () => {
  const buffer = freshBuffer();
  const english = renderBuffer(buffer, "en");
  const hangul = renderBuffer(buffer, "ko-Hang");
  assert.notEqual(english, hangul);
  assert.equal(hangul[0]?.lang, "ko-Hang");
});

test("only the most recently rendered buffers are kept", () => {
  const oldest = freshBuffer();
  const oldestViews = renderBuffer(oldest, "en");
  for (let count = 0; count < RECENT_BUFFERS_KEPT; count += 1) renderBuffer(freshBuffer(), "en");
  assert.notEqual(renderBuffer(oldest, "en"), oldestViews);
});

test("a full cache drops the least recently used value", () => {
  const cache = recentlyUsedCache<string>(2);
  cache.set("a", "A");
  cache.set("b", "B");
  cache.set("c", "C");
  assert.equal(cache.get("a"), undefined);
  assert.equal(cache.get("b"), "B");
  assert.equal(cache.get("c"), "C");
});

test("reading a value makes it the most recently used", () => {
  const cache = recentlyUsedCache<string>(2);
  cache.set("a", "A");
  cache.set("b", "B");
  cache.get("a");
  cache.set("c", "C");
  assert.equal(cache.get("a"), "A");
  assert.equal(cache.get("b"), undefined);
});

test("setting a kept key again replaces its value and makes it the most recently used", () => {
  const cache = recentlyUsedCache<string>(2);
  cache.set("a", "A");
  cache.set("b", "B");
  cache.set("a", "A2");
  cache.set("c", "C");
  assert.equal(cache.get("a"), "A2");
  assert.equal(cache.get("b"), undefined);
});
