import assert from "node:assert/strict";
import test from "node:test";
import { imageMarkdown, isImageBaseName, normalizedImageBaseName } from "./image-names.ts";

test("an image name is compared trimmed and lowercased", () => {
  assert.equal(normalizedImageBaseName("  Cat-Photo "), "cat-photo");
});

test("an image name is lowercase letters, digits, dots, hyphens and underscores, starting with a letter or digit", () => {
  for (const name of ["cat", "2026-09-01", "cat_photo.v2"]) assert.ok(isImageBaseName(name), name);
  for (const name of ["", "-cat", ".cat", "Cat", "cat photo", "고양이", "cat/photo"]) {
    assert.ok(!isImageBaseName(name), name);
  }
});

test("an image is referenced relative to the published post page", () => {
  assert.equal(imageMarkdown("cat.png"), "![](./cat.png)");
});
