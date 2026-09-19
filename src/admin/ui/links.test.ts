import assert from "node:assert/strict";
import test from "node:test";
import { editorHref, newTranslationHref, publishedPostHref } from "./links.ts";

test("the editor is opened on a source file named in its query", () => {
  assert.equal(editorHref("2026/02/career.ko-Hang.md"), "/admin/edit?file=2026%2F02%2Fcareer.ko-Hang.md");
});

test("a translation is started from the post it translates and its language", () => {
  assert.equal(newTranslationHref("2026/02/career", "en"), "/admin/new?translationOf=2026%2F02%2Fcareer&lang=en");
});

test("a published post lives at its path with a trailing slash", () => {
  assert.equal(publishedPostHref("2026/02/career"), "/2026/02/career/");
});
