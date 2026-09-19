import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  CONTENT_ROOT,
  PathError,
  assertNoSymlink,
  contentPath,
  resolvePostDir,
  resolvePostFile,
  splitPostFileName,
} from "./paths.ts";

function assertPathError(run: () => unknown, message: string): void {
  assert.throws(run, (error: unknown) => error instanceof PathError && error.message === message);
}

test("a post file path is split into its date directory, slug and language", () => {
  assert.deepEqual(resolvePostFile("2026/02/career.ko-Hang.md"), {
    rel: "2026/02/career.ko-Hang.md",
    abs: path.join(CONTENT_ROOT, "2026", "02", "career.ko-Hang.md"),
    year: "2026",
    month: "02",
    slug: "career",
    lang: "ko-Hang",
    postPath: "2026/02/career",
  });
});

test("legacy slugs with capitals, dots and underscores stay openable", () => {
  const ref = resolvePostFile("2023/11/Old_Name.v2.en.md");
  assert.equal(ref.slug, "Old_Name.v2");
  assert.equal(ref.lang, "en");
});

test("only the language right before .md is the post's language", () => {
  const ref = resolvePostFile("2026/02/notes.ko-Kore.en.md");
  assert.equal(ref.slug, "notes.ko-Kore");
  assert.equal(ref.lang, "en");
  assert.equal(ref.postPath, "2026/02/notes.ko-Kore");
});

test("paths that are not a post file under a year and month are rejected", () => {
  for (const rel of [
    "2026/02/career.fr.md",
    "2026/02/career.ko-Hang.txt",
    "2026/02/.ko-Hang.md",
    "2026/02/_draft.ko-Hang.md",
    "1999/02/career.en.md",
    "2026/2/career.en.md",
    "2026/02/career/index.en.md",
    "2026/career.en.md",
  ]) {
    assertPathError(() => resolvePostFile(rel), "not a post path like 2026/02/slug.ko-Hang.md");
  }
});

test("a post directory is split into its date directory and slug", () => {
  assert.deepEqual(resolvePostDir("2026/02/career"), {
    rel: "2026/02/career",
    abs: path.join(CONTENT_ROOT, "2026", "02", "career"),
    year: "2026",
    month: "02",
    slug: "career",
  });
  assertPathError(() => resolvePostDir("2026/02"), "not a post path like 2026/02/slug");
  assertPathError(() => resolvePostDir("2026/02/career/extra"), "not a post path like 2026/02/slug");
});

test("empty and overlong paths are rejected before their shape is looked at", () => {
  assertPathError(() => resolvePostFile(""), "path is empty or too long");
  const overlong = `2026/02/${"a".repeat(200)}.en.md`;
  assertPathError(() => resolvePostFile(overlong), "path is empty or too long");
  assertPathError(() => resolvePostDir(`2026/02/${"a".repeat(193)}`), "path is empty or too long");
  assert.equal(resolvePostDir(`2026/02/${"a".repeat(192)}`).slug.length, 192);
});

test("backslashes, percent-encoding, NUL and spaces cannot reach the pattern", () => {
  for (const rel of [
    "2026\\02\\career.en.md",
    "2026/02/..%2fcareer.en.md",
    "2026/02/career.en.md\0.png",
    "2026/02/my post.en.md",
    "2026/02/글.en.md",
  ]) {
    assertPathError(() => resolvePostFile(rel), "path contains a disallowed character");
  }
});

test("parent segments, absolute paths and empty segments are not repo-relative", () => {
  for (const rel of [
    "2026/02/../career.en.md",
    "2026/02/..career.en.md",
    "/2026/02/career.en.md",
    "2026//02/career.en.md",
  ]) {
    assertPathError(() => resolvePostFile(rel), "path is not repo-relative");
  }
});

test("a source file name splits into the part before its language and the language", () => {
  assert.deepEqual(splitPostFileName("career.ko-Hang.md"), { stem: "career", lang: "ko-Hang" });
  assert.deepEqual(splitPostFileName("notes.ko-Kore.en.md"), { stem: "notes.ko-Kore", lang: "en" });
  assert.deepEqual(splitPostFileName("2026/02/career.ko-Kore.md"), { stem: "2026/02/career", lang: "ko-Kore" });
  for (const name of ["career.fr.md", "career.en.markdown", ".en.md", "career.md", "career.en.md.bak"]) {
    assert.equal(splitPostFileName(name), null, name);
  }
});

test("a repo-relative path becomes an absolute path under the content root", () => {
  assert.equal(contentPath("2026/02/career"), path.join(CONTENT_ROOT, "2026", "02", "career"));
  assert.equal(contentPath("links.yaml"), path.join(CONTENT_ROOT, "links.yaml"));
});

test("writing through a symlinked ancestor or file is refused", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paths-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const elsewhere = await fs.mkdtemp(path.join(os.tmpdir(), "paths-target-"));
  t.after(() => fs.rm(elsewhere, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "2026"));
  await fs.symlink(elsewhere, path.join(root, "2026", "02"));
  await fs.mkdir(path.join(root, "2025", "01"), { recursive: true });
  await fs.writeFile(path.join(elsewhere, "real.en.md"), "");
  await fs.symlink(path.join(elsewhere, "real.en.md"), path.join(root, "2025", "01", "link.en.md"));

  await assert.rejects(
    assertNoSymlink("2026/02/career.en.md", root),
    (error: unknown) => error instanceof PathError && error.message === "symlink in path: 2026/02/career.en.md",
  );
  await assert.rejects(
    assertNoSymlink("2025/01/link.en.md", root),
    (error: unknown) => error instanceof PathError && error.message === "symlink in path: 2025/01/link.en.md",
  );
});

test("paths that do not exist yet, or exist without symlinks, may be written", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "paths-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "2026", "02"), { recursive: true });
  await fs.writeFile(path.join(root, "2026", "02", "career.en.md"), "");

  await assertNoSymlink("2026/02/career.en.md", root);
  await assertNoSymlink("2026/02/new.en.md", root);
  await assertNoSymlink("2027/01/new.en.md", root);
});
