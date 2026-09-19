import assert from "node:assert/strict";
import test from "node:test";
import type { SourceResponse } from "../lib/types.ts";
import { createImagePaste } from "./imagePaste.ts";
import { createPublishedPreview } from "./publishedPreview.ts";

type Source = Extract<SourceResponse, { ok: true }>;
const source: Source = {
  ok: true, file: "2026/09/post.en.md", postPath: "2026/09/post",
  year: "2026", month: "09", slug: "post", lang: "en",
  fenceRaw: "---\n---", body: "original", frontmatter: { published: "" },
  mtimeMs: 1, assets: [],
};
const json = (value: unknown) => new Response(JSON.stringify(value));
const nextTurn = () => new Promise<void>((resolve) => setImmediate(resolve));

test("image paste waits for each choice, skips cancellation and failures, and preserves order", async (t) => {
  const warnings: string[] = [];
  const revoked: string[] = [];
  const uploads: FormData[] = [];
  let suggestions = 0;
  t.mock.method(URL, "createObjectURL", () => `blob:${suggestions}`);
  t.mock.method(URL, "revokeObjectURL", (url: string) => revoked.push(url));
  t.mock.method(globalThis, "fetch", async (url: string, init?: RequestInit) => {
    if (url.startsWith("/admin/api/image-name?")) {
      suggestions++;
      const query = new URLSearchParams(url.split("?")[1]);
      assert.equal(query.get("mdFile"), source.file);
      assert.equal(query.get("mime"), "image/png");
      if (suggestions === 2) return json({ ok: false, message: "bad type" });
      return json({ ok: true, suggestion: `image-${suggestions}`, ext: ".png", dir: "post", existing: [] });
    }
    assert.equal(url, "/admin/api/image");
    assert.equal(init?.method, "POST");
    uploads.push(init?.body as FormData);
    return uploads.length === 1
      ? json({ ok: false, message: "upload failed" })
      : json({ ok: true, markdown: `![image ${uploads.length}](./image.png)` });
  });
  const images = createImagePaste(() => source, (warning) => warnings.push(warning));
  const result = images.paste(Array.from({ length: 5 }, () => new File(["image"], "image.png", { type: "image/png" })));
  await nextTurn();
  assert.equal(suggestions, 1);
  assert.equal(images.dialog()?.preview, "blob:1");
  images.cancelName();
  await nextTurn();
  assert.equal(suggestions, 3);
  images.confirmName({ name: "third", overwrite: true });
  await nextTurn();
  images.confirmName({ name: "fourth", overwrite: false });
  await nextTurn();
  images.confirmName({ name: "fifth", overwrite: false });
  assert.equal(await result, "![image 2](./image.png)\n\n![image 3](./image.png)");
  assert.deepEqual(warnings, ["bad type", "upload failed"]);
  assert.deepEqual(revoked, ["blob:1", "blob:3", "blob:4", "blob:5"]);
  assert.equal(images.dialog(), null);
  assert.equal(uploads[0]?.get("mdFile"), source.file);
  assert.equal(uploads[0]?.get("name"), "third");
  assert.equal(uploads[0]?.get("overwrite"), "true");
});

test("controllers ignore requests until a source is available", async (t) => {
  const fetch = t.mock.method(globalThis, "fetch", async () => { throw new Error("unexpected request"); });
  const images = createImagePaste(() => undefined, () => {});
  assert.equal(await images.paste([new File([], "image.png")]), null);
  const preview = createPublishedPreview(() => null, () => source.frontmatter, () => source.body);
  await preview.refresh();
  assert.equal(preview.loading(), false);
  assert.equal(fetch.mock.callCount(), 0);
});

test("preview reads current edits on refresh and retains prior output after failure", async (t) => {
  let body = "first edit";
  let fail = false;
  const requests: unknown[] = [];
  const views = [{ lang: "en", title: "Title", document: "<p>preview</p>" }];
  t.mock.method(globalThis, "fetch", async (_url: string, init: RequestInit) => {
    requests.push(JSON.parse(init.body as string));
    if (fail) throw new Error("preview failed");
    return json({ ok: true, views, ms: 23 });
  });
  const preview = createPublishedPreview(() => source, () => source.frontmatter, () => body);
  preview.toggle();
  assert.equal(preview.visible(), true);
  assert.equal(preview.loading(), true);
  await nextTurn();
  assert.deepEqual(preview.views(), views);
  assert.equal(preview.elapsedMs(), 23);
  preview.close();
  assert.equal(requests.length, 1);
  body = "second edit";
  fail = true;
  await preview.refresh();
  assert.deepEqual(requests[1], { file: source.file, frontmatter: source.frontmatter, body, lang: "en" });
  assert.equal(preview.error(), "preview failed");
  assert.equal(preview.loading(), false);
  assert.deepEqual(preview.views(), views);
  fail = false;
  await preview.refresh();
  assert.equal(preview.error(), "");
});
