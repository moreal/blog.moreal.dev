import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  composeSavedSource,
  formatAndReadSavedPost,
  isStaleSave,
  replacePostFileAtomically,
} from "./save.ts";
import { resolvePostFile } from "./paths.ts";

const frontmatter = { published: "2026-09-08T10:00:00+09:00", draft: true };
const fenceRaw = '---\npublished: "2026-09-08T10:00:00+09:00"\ndraft: "true"\n---\n';

test("unchanged metadata preserves original quoting while body line endings normalize", () => {
  assert.equal(
    composeSavedSource({ frontmatter, fenceRaw, body: "Title\r\n=====\r\n\r\nText\r\n\r\n" }),
    fenceRaw + "\nTitle\n=====\n\nText\n",
  );
});

test("edited metadata replaces the original front matter", () => {
  const source = composeSavedSource({ frontmatter: { ...frontmatter, draft: false }, fenceRaw, body: "" });
  assert.equal(source, "---\npublished: 2026-09-08T10:00:00+09:00\n---\n\n\n");
});

test("saving replaces disk content and returns the stored body and modification time", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "blog-save-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const ref = { ...resolvePostFile("2026/09/post.ko-Hang.md"), abs: path.join(directory, "post.ko-Hang.md") };
  await fs.writeFile(ref.abs, "old content");
  const source = composeSavedSource({ frontmatter, fenceRaw, body: "Title\n=====\n" });
  await replacePostFileAtomically(ref.abs, source);
  assert.equal(await fs.readFile(ref.abs, "utf-8"), source);
  assert.deepEqual(await fs.readdir(directory), ["post.ko-Hang.md"]);
  const saved = await formatAndReadSavedPost(ref, false);
  assert.equal(saved.fenceRaw, fenceRaw);
  assert.equal(saved.body, "\nTitle\n=====\n");
  assert.equal(saved.mtimeMs, (await fs.stat(ref.abs)).mtimeMs);
  assert.equal(saved.formatted, false);
});

test("failed replacement removes the temporary file and preserves the destination", async (t) => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "blog-save-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const destination = path.join(directory, "post.ko-Hang.md");
  await fs.mkdir(destination);
  await assert.rejects(replacePostFileAtomically(destination, "new content"));
  assert.deepEqual(await fs.readdir(directory), ["post.ko-Hang.md"]);
  assert.ok((await fs.stat(destination)).isDirectory());
});

test("a file is unchanged since it was loaded while its mtime is within a millisecond of the one the editor holds", () => {
  assert.equal(isStaleSave({ expectedMtimeMs: 1000 }, 1000), false);
  assert.equal(isStaleSave({ expectedMtimeMs: 1000.4 }, 1001), false);
  assert.equal(isStaleSave({ expectedMtimeMs: 1000 }, 1002), true);
  assert.equal(isStaleSave({ expectedMtimeMs: 1002 }, 1000), true);
});

test("a save that names no mtime skips the check", () => {
  assert.equal(isStaleSave({}, 1000), false);
  assert.equal(isStaleSave({ expectedMtimeMs: "1000" }, 5), false);
});

test("an overwrite is never stale, so the writer who chose it replaces the file", () => {
  assert.equal(isStaleSave({ expectedMtimeMs: 1000, force: true }, 5000), false);
  assert.equal(isStaleSave({ expectedMtimeMs: 1000, force: false }, 5000), true);
});
