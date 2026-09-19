import assert from "node:assert/strict";
import test from "node:test";
import { imageSizeProblem, uploadedImageFileName } from "./image-upload.ts";

test("an image within the size limit passes, and a larger one is reported in kilobytes", () => {
  assert.equal(imageSizeProblem(1024, 1024), null);
  assert.equal(imageSizeProblem(8 * 1024 * 1024 + 1, 8 * 1024 * 1024), "8192KB — 상한은 8192KB입니다.");
  assert.equal(imageSizeProblem(3000, 2048), "3KB — 상한은 2KB입니다.");
});

test("the uploaded file is named after the requested name, trimmed and lowercased, with the type's extension", () => {
  assert.equal(uploadedImageFileName(" Cat-Photo ", ".png"), "cat-photo.png");
});

test("a requested name that already ends in the extension is not given a second one", () => {
  assert.equal(uploadedImageFileName("screenshot.png", ".png"), "screenshot.png");
  assert.equal(uploadedImageFileName("screenshot.png", ".jpg"), "screenshot.png.jpg");
});

test("a name outside the allowed characters, or one containing '..', is refused", () => {
  assert.equal(uploadedImageFileName("../evil", ".png"), null);
  assert.equal(uploadedImageFileName("a..b", ".png"), null);
  assert.equal(uploadedImageFileName("has space", ".png"), null);
  assert.equal(uploadedImageFileName("", ".png"), null);
});
