import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { adminPathnames, outputFilesMentioningAdmin } from "./integration.ts";

test("a built page under /admin or /__admin is an admin route that leaked", () => {
  assert.deepEqual(
    adminPathnames(["", "daily/", "admin", "admin/api/posts", "__admin/x", "2026/02/admin-notes/"]),
    ["admin", "admin/api/posts", "__admin/x"],
  );
});

test("text output that mentions an admin API URL or admin source path is reported relative to the output root", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blog-integration-test-"));
  await fs.mkdir(path.join(root, "_astro"));
  await fs.writeFile(path.join(root, "index.html"), "<p>clean</p>");
  await fs.writeFile(path.join(root, "_astro", "app.js"), 'fetch("/admin/api/posts")');
  await fs.writeFile(path.join(root, "_astro", "map.json"), '{"source":"src/admin/ui/Editor.tsx"}');
  await fs.writeFile(path.join(root, "image.png"), "src/admin/ in a binary");
  assert.deepEqual((await outputFilesMentioningAdmin(root)).sort(), ["/_astro/app.js", "/_astro/map.json"]);
});
