import assert from "node:assert/strict";
import test from "node:test";
import { assetContentType } from "./asset-content-type.ts";

test("an image beside a post is served with the type its extension names, in any case", () => {
  assert.equal(assetContentType("/repo/2026/08/post/screenshot.png"), "image/png");
  assert.equal(assetContentType("photo.JPG"), "image/jpeg");
  assert.equal(assetContentType("photo.jpeg"), "image/jpeg");
  assert.equal(assetContentType("diagram.svg"), "image/svg+xml");
  assert.equal(assetContentType("a.webp"), "image/webp");
  assert.equal(assetContentType("a.avif"), "image/avif");
  assert.equal(assetContentType("a.gif"), "image/gif");
});

test("any other file is served as opaque bytes", () => {
  assert.equal(assetContentType("notes.pdf"), "application/octet-stream");
  assert.equal(assetContentType("README"), "application/octet-stream");
});
