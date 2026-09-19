import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileExists, readTextOrNull, writeWithoutClobbering } from "./files.ts";

const directory = await fs.mkdtemp(path.join(os.tmpdir(), "blog-files-test-"));

test("a file exists once written, and a missing one does not", async () => {
  const file = path.join(directory, "exists.md");
  assert.equal(await fileExists(file), false);
  await fs.writeFile(file, "text");
  assert.equal(await fileExists(file), true);
});

test("writing without clobbering creates a new file but refuses to replace an existing one", async () => {
  const file = path.join(directory, "new.md");
  await writeWithoutClobbering(file, "first");
  await assert.rejects(writeWithoutClobbering(file, "second"), { code: "EEXIST" });
  assert.equal(await fs.readFile(file, "utf-8"), "first");
});

test("bytes are written as they are", async () => {
  const file = path.join(directory, "image.png");
  await writeWithoutClobbering(file, Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  assert.deepEqual([...(await fs.readFile(file))], [0x89, 0x50, 0x4e, 0x47]);
});

test("reading text yields the file's contents, or null when it cannot be read", async () => {
  const file = path.join(directory, "readable.md");
  await fs.writeFile(file, "본문");
  assert.equal(await readTextOrNull(file), "본문");
  assert.equal(await readTextOrNull(path.join(directory, "missing.md")), null);
  assert.equal(await readTextOrNull(directory), null);
});
