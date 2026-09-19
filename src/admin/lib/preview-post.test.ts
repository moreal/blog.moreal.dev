import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import type { PostView } from "../../lib/posts.ts";
import type { PostFileRef } from "./paths.ts";
import { previewPost, siblingViewLangs, withBaseHref } from "./preview-post.ts";
import type { Lang } from "./types.ts";

async function monthDirectoryWith(t: TestContext, names: string[]): Promise<string> {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "blog-preview-post-test-"));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  for (const name of names) await fs.writeFile(path.join(directory, name), "");
  return directory;
}

function bufferRef(slug: string, lang: Lang, directory = "/blog/2026/02"): PostFileRef {
  return {
    rel: `2026/02/${slug}.${lang}.md`,
    abs: path.join(directory, `${slug}.${lang}.md`),
    year: "2026",
    month: "02",
    slug,
    lang,
    postPath: `2026/02/${slug}`,
  };
}

function renderedView(lang: string, html: string): PostView {
  return {
    lang,
    html,
    title: "제목",
    published: new Date("2026-02-03T01:00:00Z"),
    draft: false,
    dark: false,
  };
}

test("other language sources of the same slug are the buffer's sibling languages", async (t) => {
  const directory = await monthDirectoryWith(t, [
    "career.ko-Hang.md",
    "career.en.md",
    "career-2.ko-Kore.md",
    "other.en.md",
    "career.txt",
  ]);
  await fs.mkdir(path.join(directory, "career"));
  assert.deepEqual(await siblingViewLangs(bufferRef("career", "ko-Hang", directory)), ["en"]);
});

test("a ko-Kore sibling brings along the ko-Hang view derived from it", async (t) => {
  const directory = await monthDirectoryWith(t, ["career.en.md", "career.ko-Kore.md"]);
  assert.deepEqual(await siblingViewLangs(bufferRef("career", "en", directory)), [
    "ko-Kore",
    "ko-Hang",
  ]);
});

test("a buffer in a month directory that does not exist yet has no sibling languages", async () => {
  const directory = path.join(os.tmpdir(), "preview-post-missing", "2099", "01");
  assert.deepEqual(await siblingViewLangs(bufferRef("career", "ko-Hang", directory)), []);
});

test("sibling languages join the post as views without a body, only for the language nav", () => {
  const post = previewPost(
    bufferRef("career", "ko-Hang"),
    [renderedView("ko-Hang", "<p>본문</p>")],
    ["en"],
  );
  assert.deepEqual(post, {
    path: "2026/02/career",
    year: "2026",
    month: "02",
    slug: "career",
    views: [renderedView("en", ""), renderedView("ko-Hang", "<p>본문</p>")],
    multiview: true,
  });
});

test("a buffer without siblings previews as a single-language post", () => {
  const post = previewPost(
    bufferRef("career", "en"),
    [renderedView("en", "<p>body</p>")],
    [],
  );
  assert.equal(post.multiview, false);
  assert.deepEqual(post.views, [renderedView("en", "<p>body</p>")]);
});

test("the preview post orders its views as the published post does", () => {
  const post = previewPost(
    bufferRef("career", "ko-Kore"),
    [renderedView("ko-Kore", "<p>漢字</p>"), renderedView("ko-Hang", "<p>한자</p>")],
    ["en"],
  );
  assert.deepEqual(
    post.views.map((view) => view.lang),
    ["ko-Kore", "ko-Hang", "en"],
  );
});

test("a buffer that rendered no views cannot be previewed", () => {
  assert.throws(() => previewPost(bufferRef("career", "en"), [], ["ko-Hang"]), {
    message: "the buffer rendered no views.",
  });
});

test("a <base> after <head> resolves ./image.png against the post's published URL", () => {
  assert.equal(
    withBaseHref("<html><head><title>t</title></head></html>", "2026/02/career"),
    '<html><head><base href="/2026/02/career/"><title>t</title></head></html>',
  );
});

test("attributes on <head> are kept when the <base> is inserted", () => {
  assert.equal(
    withBaseHref('<head data-x="1"></head>', "2026/02/career"),
    '<head data-x="1"><base href="/2026/02/career/"></head>',
  );
});

test("a document without <head> is left as is, with a warning", (t) => {
  const warn = t.mock.method(console, "warn", () => {});
  const html = "<body><header>제목</header></body>";
  assert.equal(withBaseHref(html, "2026/02/career"), html);
  assert.equal(warn.mock.callCount(), 1);
});
