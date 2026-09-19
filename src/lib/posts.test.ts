import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  kstDate,
  parseFrontMatter,
  parseSourceFileName,
  renderViews,
  sortPostViews,
  splitFrontMatter,
  postPathOf,
  viewFilename,
  viewUrl,
  walkContent,
  withoutDrafts,
  type Post,
  type PostView,
} from "./posts.ts";

function source(frontMatter: string, body = "Title\n=====\n\nText\n"): string {
  return `---\n${frontMatter}\n---\n${body}`;
}

test("front matter yields its fields and the body after the closing fence", () => {
  const { meta, body } = parseFrontMatter(
    source('published: 2026-03-01T10:00:00+09:00\ndescription: "Hello"', "\nBody\n"),
    "post.md",
  );
  assert.deepEqual(meta, {
    published: new Date("2026-03-01T01:00:00Z"),
    description: "Hello",
    draft: false,
    dark: false,
    type: undefined,
    book: undefined,
  });
  assert.equal(body, "\nBody\n");
});

test("a quoted published timestamp is parsed as a date", () => {
  const { meta } = parseFrontMatter(source('published: "2026-03-01T10:00:00+09:00"'), "post.md");
  assert.equal(meta.published.toISOString(), "2026-03-01T01:00:00.000Z");
});

test("the front matter fence is kept verbatim, CRLF line endings included", () => {
  assert.deepEqual(splitFrontMatter("---\r\npublished: x\r\n---\r\nBody\r\n", "post.md"), {
    fence: "---\r\npublished: x\r\n---\r\n",
    yaml: "published: x",
    body: "Body\r\n",
  });
});

test("a source without a front matter fence is rejected", () => {
  assert.throws(() => parseFrontMatter("Title\n=====\n", "post.md"), {
    message: "post.md: missing front matter.",
  });
});

test("a missing or unparseable published timestamp is rejected", () => {
  for (const frontMatter of ["draft: true", "published: someday", "published: 3"]) {
    assert.throws(() => parseFrontMatter(source(frontMatter), "post.md"), {
      message: 'post.md: front matter lacks a "published" timestamp.',
    });
  }
});

test("daily and reading are the only post types, and a null type means a regular article", () => {
  const typeOf = (line: string) =>
    parseFrontMatter(source(`published: 2026-03-01T10:00:00+09:00\n${line}`), "post.md").meta.type;
  assert.equal(typeOf("type: daily"), "daily");
  assert.equal(typeOf("type: reading"), "reading");
  assert.equal(typeOf("type:"), undefined);
});

test("a misspelled post type fails instead of demoting the post to a regular article", () => {
  assert.throws(
    () => parseFrontMatter(source("published: 2026-03-01T10:00:00+09:00\ntype: dialy"), "post.md"),
    { message: 'post.md: unknown post type "dialy"; expected "daily" or "reading".' },
  );
});

test("any non-empty draft value counts as a draft, as it did under jikji", () => {
  const draftOf = (line: string) =>
    parseFrontMatter(source(`published: 2026-03-01T10:00:00+09:00\n${line}`), "post.md").meta.draft;
  assert.equal(draftOf('draft: "true"'), true);
  assert.equal(draftOf('draft: "false"'), true);
  assert.equal(draftOf("draft: false"), false);
  assert.equal(draftOf('draft: ""'), false);
});

test("a description that is not a string is ignored", () => {
  const { meta } = parseFrontMatter(
    source("published: 2026-03-01T10:00:00+09:00\ndescription: 42\ndark: true"),
    "post.md",
  );
  assert.equal(meta.description, undefined);
  assert.equal(meta.dark, true);
});

test("book metadata keeps only fields of the expected type", () => {
  const { meta } = parseFrontMatter(
    source(
      "published: 2026-03-01T10:00:00+09:00\ntype: reading\nbook:\n  title: 책\n  author: 저자\n  translator: 7\n  year: 2020",
    ),
    "post.md",
  );
  assert.deepEqual(meta.book, {
    title: "책",
    author: "저자",
    translator: undefined,
    publisher: undefined,
    year: 2020,
  });
});

test("a scaffolded book block with blank values counts as no book", () => {
  const { meta } = parseFrontMatter(
    source("published: 2026-03-01T10:00:00+09:00\ntype: reading\nbook:\n  title:\n  author:"),
    "post.md",
  );
  assert.equal(meta.book, undefined);
});

test("a single-language source renders one view titled by its first heading", () => {
  const views = renderViews(source("published: 2026-03-01T10:00:00+09:00\ndraft: true"), "en");
  assert.equal(views.length, 1);
  const [view] = views;
  assert.equal(view?.lang, "en");
  assert.equal(view?.title, "Title");
  assert.equal(view?.html, "<h1>Title</h1>\n<p>Text</p>\n");
  assert.equal(view?.draft, true);
});

test("a ko-Kore source renders its Hanja in ruby and derives a Hangul-only ko-Hang view", () => {
  const views = renderViews(
    source("published: 2026-03-01T10:00:00+09:00", "제목\n====\n\n漢字를 쓴다.\n"),
    "ko-Kore",
  );
  assert.deepEqual(views.map((view) => view.lang), ["ko-Kore", "ko-Hang"]);
  const [kore, hang] = views;
  assert.match(kore?.html ?? "", /<ruby>漢字<rp>\(<\/rp><rt>한자<\/rt><rp>\)<\/rp><\/ruby>/);
  assert.match(hang?.html ?? "", /한자를 쓴다/);
  assert.doesNotMatch(hang?.html ?? "", /漢字/);
});

function viewIn(lang: string, draft = false): PostView {
  return { lang, html: "", title: "", published: new Date(0), draft, dark: false };
}

function viewsIn(...langs: string[]): PostView[] {
  return langs.map((lang) => viewIn(lang));
}

test("views from separate source files are ordered alphabetically by language", () => {
  const views = viewsIn("ko-Hang", "en");
  sortPostViews(views);
  assert.deepEqual(views.map((view) => view.lang), ["en", "ko-Hang"]);
});

test("a ko-Kore original comes before its derived ko-Hang view, then other languages", () => {
  const views = viewsIn("en", "ko-Hang", "ko-Kore");
  sortPostViews(views);
  assert.deepEqual(views.map((view) => view.lang), ["ko-Kore", "ko-Hang", "en"]);
});

test("dates are read in Asia/Seoul, where the posts are written", () => {
  assert.deepEqual(kstDate(new Date("2025-12-31T15:00:00Z")), { year: 2026, month: 1, day: 1 });
});

test("a view file name lowercases the language tag", () => {
  assert.equal(viewFilename("ko-Hang"), "index.ko-hang.html");
});

test("content is read from year/month directories, with a directory beside a post holding its assets", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blog-posts-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const files = [
    "2026/03/post.ko-Hang.md",
    "2026/03/.hidden.ko-Hang.md",
    "2026/03/notes.txt",
    "2026/03/post/image.png",
    "2026/03/post/.DS_Store",
    "2026/03/post/nested/deep.png",
    "2026/03/.cache/stale.png",
    "2026/.drafts/draft.ko-Hang.md",
    "1999/01/old.ko-Hang.md",
    "drafts/01/loose.ko-Hang.md",
  ];
  for (const file of files) {
    await fs.mkdir(path.join(root, path.dirname(file)), { recursive: true });
    await fs.writeFile(path.join(root, file), "");
  }
  await fs.writeFile(path.join(root, "2027"), "");

  const content = await walkContent(root);

  assert.deepEqual(content.files, [
    { year: "2026", month: "03", name: "post.ko-Hang.md", sourcePath: path.join(root, "2026/03/post.ko-Hang.md") },
  ]);
  assert.deepEqual(content.assetDirectories, [
    {
      year: "2026",
      month: "03",
      slug: "post",
      assets: [
        { year: "2026", month: "03", slug: "post", file: "image.png", sourcePath: path.join(root, "2026/03/post/image.png") },
      ],
    },
  ]);
});

test("a directory beside a post is an asset directory even when it holds no visible file", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blog-posts-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "2026/03/emptied"), { recursive: true });
  await fs.writeFile(path.join(root, "2026/03/emptied/.DS_Store"), "");

  const content = await walkContent(root);

  assert.deepEqual(content.assetDirectories, [{ year: "2026", month: "03", slug: "emptied", assets: [] }]);
});

test("a source file name carries the post slug and a language tag", () => {
  assert.deepEqual(parseSourceFileName("botkit.ko-Kore.md"), { slug: "botkit", lang: "ko-Kore" });
  assert.deepEqual(parseSourceFileName("v1.2.en.md"), { slug: "v1.2", lang: "en" });
  assert.equal(parseSourceFileName("README.md"), undefined);
  assert.equal(parseSourceFileName("post.KO.md"), undefined);
});

function postWith(slug: string, ...views: PostView[]): Post {
  return { path: `2026/03/${slug}`, year: "2026", month: "03", slug, views, multiview: views.length > 1 };
}

test("draft views are dropped, and so are posts left with no view", () => {
  const posts = withoutDrafts([
    postWith("translated", viewIn("en", true), viewIn("ko-Hang")),
    postWith("unfinished", viewIn("ko-Hang", true)),
    postWith("published", viewIn("en"), viewIn("ko-Hang")),
  ]);
  assert.deepEqual(
    posts.map((post) => [post.slug, post.views.map((view) => view.lang), post.multiview]),
    [
      ["translated", ["ko-Hang"], false],
      ["published", ["en", "ko-Hang"], true],
    ],
  );
});

test("a post's path joins its year, month and slug", () => {
  assert.equal(postPathOf({ year: "2026", month: "03", slug: "botkit" }), "2026/03/botkit");
});

test("a language view of a multiview post is served from its own file under the post path", () => {
  assert.equal(viewUrl("2026/03/botkit", "ko-Kore"), "/2026/03/botkit/index.ko-kore.html");
});
