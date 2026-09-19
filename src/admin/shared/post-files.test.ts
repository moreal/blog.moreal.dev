import assert from "node:assert/strict";
import test from "node:test";
import { CREATE_SLUG, LANGS, derivedLangsOf, postFileName } from "./post-files.ts";

test("new slugs are lowercase words joined by hyphens, so impossible dates still pass", () => {
  for (const slug of ["a-post", "2026", "2026-02-31"]) assert.ok(CREATE_SLUG.test(slug), slug);
  for (const slug of ["A-post", "-post", "a_post", "a.post", ""]) assert.ok(!CREATE_SLUG.test(slug), slug);
});

test("a post file is named after its slug and language", () => {
  assert.equal(postFileName("career", "ko-Hang"), "career.ko-Hang.md");
  assert.equal(postFileName("2026-02-03", "en"), "2026-02-03.en.md");
});

test("languages are listed in the order their sources are preferred", () => {
  assert.deepEqual(LANGS, ["ko-Hang", "ko-Kore", "en"]);
});

test("a ko-Kore source also yields the ko-Hang view seonbi derives at build time", () => {
  assert.deepEqual(derivedLangsOf("ko-Kore"), ["ko-Hang"]);
});

test("other sources yield no view but their own", () => {
  assert.deepEqual(derivedLangsOf("ko-Hang"), []);
  assert.deepEqual(derivedLangsOf("en"), []);
});
