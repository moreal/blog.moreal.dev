import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { listAssetNames, listAssets, scanPosts } from "./scan.ts";

async function contentRoot(t: TestContext, entries: Record<string, string | null>): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blog-scan-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  for (const [entry, text] of Object.entries(entries)) {
    const entryPath = path.join(root, entry);
    if (text === null) {
      await fs.mkdir(entryPath, { recursive: true });
    } else {
      await fs.mkdir(path.dirname(entryPath), { recursive: true });
      await fs.writeFile(entryPath, text);
    }
  }
  return root;
}

function post(published: string, heading = "Title"): string {
  return `---\npublished: ${published}\n---\n\n${heading}\n=====\n`;
}

test("a source is summarised from its front matter, its first heading and its file stat", async (t) => {
  const text =
    '---\npublished: "2026-03-01T10:00:00+09:00"\ndescription: 소개\ndraft: true\ndark: true\n' +
    "type: reading\nbook:\n  title: 모모\n---\n\n읽은 책\n=====\n\n본문\n";
  const root = await contentRoot(t, { "2026/03/momo.ko-Kore.md": text });
  const { mtimeMs } = await fs.stat(path.join(root, "2026/03/momo.ko-Kore.md"));

  const [group] = await scanPosts(root);

  assert.deepEqual(group?.sources, [
    {
      file: "2026/03/momo.ko-Kore.md",
      postPath: "2026/03/momo",
      year: "2026",
      month: "03",
      slug: "momo",
      lang: "ko-Kore",
      title: "읽은 책",
      published: "2026-03-01T10:00:00+09:00",
      publishedMs: Date.parse("2026-03-01T01:00:00Z"),
      description: "소개",
      draft: true,
      dark: true,
      derivedLangs: ["ko-Hang"],
      bytes: Buffer.byteLength(text),
      mtimeMs,
      type: "reading",
      book: { title: "모모", author: undefined, translator: undefined, publisher: undefined, year: undefined },
    },
  ]);
});

test("optional front matter fields are left out of the summary when the source does not set them", async (t) => {
  const root = await contentRoot(t, { "2026/03/plain.en.md": post("2026-03-01T10:00:00+09:00") });
  const [group] = await scanPosts(root);
  const [summary] = group?.sources ?? [];
  assert.deepEqual(Object.keys(summary ?? {}).sort(), [
    "bytes",
    "dark",
    "derivedLangs",
    "draft",
    "file",
    "lang",
    "month",
    "mtimeMs",
    "postPath",
    "published",
    "publishedMs",
    "slug",
    "title",
    "year",
  ]);
  assert.equal(summary?.draft, false);
  assert.equal(summary?.dark, false);
  assert.deepEqual(summary?.derivedLangs, []);
});

test("a source whose front matter cannot be read is still listed, carrying the error instead of its fields", async (t) => {
  const text = "Title\n=====\n";
  const root = await contentRoot(t, { "2026/03/broken.en.md": text });
  const [group] = await scanPosts(root);
  const [summary] = group?.sources ?? [];
  assert.equal(summary?.parseError, "2026/03/broken.en.md: missing front matter.");
  assert.equal(summary?.title, "");
  assert.equal(summary?.published, "");
  assert.equal(summary?.publishedMs, 0);
  assert.equal(summary?.bytes, text.length);
});

test("the language versions of a post form one group, ordered by language tag, with the languages it lacks", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/post.ko-Kore.md": post("2026-03-01T10:00:00+09:00"),
    "2026/03/post.en.md": post("2026-03-02T10:00:00+09:00"),
    "2026/03/other.ko-Hang.md": post("2026-02-01T10:00:00+09:00"),
  });
  const groups = await scanPosts(root);
  assert.deepEqual(
    groups.map((group) => [group.postPath, group.year, group.month, group.slug]),
    [
      ["2026/03/post", "2026", "03", "post"],
      ["2026/03/other", "2026", "03", "other"],
    ],
  );
  assert.deepEqual(
    groups[0]?.sources.map((source) => source.lang),
    ["en", "ko-Kore"],
  );
  assert.deepEqual(groups[0]?.missingLangs, ["ko-Hang"]);
  assert.deepEqual(groups[1]?.missingLangs, ["ko-Kore", "en"]);
});

test("groups are ordered newest first by the published time of their first listed source", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/middle.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
    "2026/03/translated.ko-Hang.md": post("2026-03-05T10:00:00+09:00"),
    "2026/03/translated.en.md": post("2026-01-01T10:00:00+09:00"),
    "2025/12/oldest.ko-Hang.md": post("2025-12-31T10:00:00+09:00"),
    "2026/03/broken.ko-Hang.md": "no front matter\n",
  });
  const groups = await scanPosts(root);
  assert.deepEqual(
    groups.map((group) => group.slug),
    ["middle", "translated", "oldest", "broken"],
  );
});

test("a source whose published text cannot be read as a time carries no publication time", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/commented.ko-Hang.md": post("2026-03-01T10:00:00+09:00 # 옮긴 날"),
  });
  const [group] = await scanPosts(root);
  const [summary] = group?.sources ?? [];
  assert.equal(summary?.published, "2026-03-01T10:00:00+09:00 # 옮긴 날");
  assert.equal(summary?.publishedMs, 0);
});

test("posts with no readable publication time are listed after every dated post", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/commented-newest.ko-Hang.md": post("2026-03-09T10:00:00+09:00 # 메모"),
    "2026/03/commented-oldest.ko-Hang.md": post("2026-03-02T10:00:00+09:00 # 메모"),
    "2026/03/newer.ko-Hang.md": post("2026-03-05T10:00:00+09:00"),
    "2026/03/older.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
  });
  const slugs = (await scanPosts(root)).map((group) => group.slug);
  assert.deepEqual(slugs.slice(0, 2), ["newer", "older"]);
  assert.deepEqual(slugs.slice(2).sort(), ["commented-newest", "commented-oldest"]);
});

test("a directory beside a post is its asset directory, counted by its visible files, even when empty", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/pictures.ko-Hang.md": post("2026-03-03T10:00:00+09:00"),
    "2026/03/pictures/a.png": "a",
    "2026/03/pictures/b.jpg": "bb",
    "2026/03/pictures/.DS_Store": "",
    "2026/03/pictures/nested/c.png": "c",
    "2026/03/emptied.ko-Hang.md": post("2026-03-02T10:00:00+09:00"),
    "2026/03/emptied": null,
    "2026/03/bare.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
  });
  const groups = await scanPosts(root);
  assert.deepEqual(
    groups.map((group) => [group.slug, group.assetDir, group.assetCount]),
    [
      ["pictures", "2026/03/pictures", 2],
      ["emptied", "2026/03/emptied", 0],
      ["bare", null, 0],
    ],
  );
});

test("only language-tagged markdown files in visible year and month directories are scanned", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/post.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
    "2026/03/README.md": post("2026-03-01T10:00:00+09:00"),
    "2026/03/post.fr.md": post("2026-03-01T10:00:00+09:00"),
    "2026/03/.hidden.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
    "2026/03/notes.txt": "",
    "2026/.drafts/draft.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
    "1999/01/old.ko-Hang.md": post("1999-01-01T10:00:00+09:00"),
    "drafts/01/loose.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
    "2027": "",
  });
  const groups = await scanPosts(root);
  assert.deepEqual(
    groups.map((group) => group.sources.map((source) => source.file)),
    [["2026/03/post.ko-Hang.md"]],
  );
});

test("the assets of a post are its visible files with their sizes", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/post/a.png": "a",
    "2026/03/post/b.jpg": "bb",
    "2026/03/post/.DS_Store": "",
    "2026/03/post/nested/c.png": "c",
  });
  const assets = await listAssets("2026/03/post", root);
  assert.deepEqual(
    assets.sort((a, b) => a.file.localeCompare(b.file)),
    [
      { file: "a.png", bytes: 1 },
      { file: "b.jpg", bytes: 2 },
    ],
  );
});

test("a post without an asset directory has no assets", async (t) => {
  const root = await contentRoot(t, { "2026/03/post.ko-Hang.md": post("2026-03-01T10:00:00+09:00") });
  assert.deepEqual(await listAssets("2026/03/post", root), []);
});

test("asset names are the file names of the post's assets, or none without an asset directory", async (t) => {
  const root = await contentRoot(t, {
    "2026/03/post/a.png": "a",
    "2026/03/post/.DS_Store": "",
    "2026/03/other.ko-Hang.md": post("2026-03-01T10:00:00+09:00"),
  });
  assert.deepEqual(await listAssetNames("2026/03/post", root), ["a.png"]);
  assert.deepEqual(await listAssetNames("2026/03/other", root), []);
});
