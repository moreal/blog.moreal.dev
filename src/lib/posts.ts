import {
  transform,
  type Configuration,
  type HanjaRenderingOption,
} from "@seonbi/node";
import { load as loadYaml } from "js-yaml";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import title from "markdown-it-title";
import { promises as fs } from "node:fs";
import path from "node:path";

// `astro dev`/`astro build` are always run from the project root, where the
// year directories (2020/, 2023/, ...) live.
const CONTENT_ROOT = process.cwd();

export type PostType = "daily" | "reading";

export interface BookInfo {
  /** Title of the book, not of the post. */
  title?: string;
  author?: string;
  translator?: string;
  publisher?: string;
  /** Publication year. */
  year?: number;
}

export interface PostView {
  /** Language tag, e.g. "ko-Hang", "ko-Kore", "en". */
  lang: string;
  /** Rendered HTML body. */
  html: string;
  /** Title extracted from the first heading of the document. */
  title: string;
  published: Date;
  description?: string;
  draft: boolean;
  /** Tells a dark story; hidden from lists until the reader turns the lights
   * off. */
  dark: boolean;
  /** Kind of post; absent for regular articles. */
  type?: PostType;
  /** Book metadata; only meaningful for "reading" posts. */
  book?: BookInfo;
}

export interface Post {
  /** URL path without leading/trailing slash, e.g. "2026/03/botkit". */
  path: string;
  year: string;
  month: string;
  slug: string;
  views: PostView[];
  /** Whether the post has multiple language views (needs content negotiation). */
  multiview: boolean;
}

export interface PostAsset {
  year: string;
  month: string;
  slug: string;
  file: string;
  /** Absolute path of the source file. */
  sourcePath: string;
}

function seonbiConfiguration(
  hanjaRendering: HanjaRenderingOption,
): Configuration {
  return {
    contentType: "text/markdown",
    quote: "CurvedQuotes",
    cite: "AngleQuotes",
    arrow: {
      bidirArrow: true,
      doubleArrow: true,
    },
    ellipsis: true,
    emDash: true,
    stop: "Horizontal",
    hanja: {
      rendering: hanjaRendering,
      reading: {
        initialSoundLaw: true,
        useDictionaries: ["kr-stdict"],
      },
    },
  };
}

function createMarkdownIt(): MarkdownIt {
  return MarkdownIt("commonmark", { html: true, xhtmlOut: false })
    .use(title)
    .use(footnote)
    .enable("strikethrough");
}

function renderMarkdown(markdown: string): { html: string; title: string } {
  const env: { title?: string } = {};
  const html = createMarkdownIt().render(markdown, env);
  return { html, title: env.title ?? "" };
}

interface FrontMatter {
  published: Date;
  description?: string;
  draft: boolean;
  dark: boolean;
  type?: PostType;
  book?: BookInfo;
}

function parseBook(data: unknown): BookInfo | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const record = data as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof record[key] === "string" ? (record[key] as string) : undefined;
  const book: BookInfo = {
    title: str("title"),
    author: str("author"),
    translator: str("translator"),
    publisher: str("publisher"),
    year: typeof record["year"] === "number" ? record["year"] : undefined,
  };
  // A scaffolded "book:" block whose values are still blank parses to all
  // nulls; treat it as absent so no empty metadata line gets rendered.
  return Object.values(book).some((v) => v !== undefined) ? book : undefined;
}

function parseFrontMatter(
  source: string,
  file: string,
): { meta: FrontMatter; body: string } {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (match === null) throw new Error(`${file}: missing front matter.`);
  const data = (loadYaml(match[1]!) ?? {}) as Record<string, unknown>;
  const rawPublished = data["published"];
  const published = rawPublished instanceof Date
    ? rawPublished
    : typeof rawPublished === "string"
    ? new Date(rawPublished)
    : undefined;
  if (published === undefined || Number.isNaN(published.getTime())) {
    throw new Error(`${file}: front matter lacks a "published" timestamp.`);
  }
  const rawType = data["type"];
  let type: PostType | undefined;
  if (rawType !== undefined && rawType !== null) {
    if (rawType === "daily" || rawType === "reading") type = rawType;
    else {
      // A typo like "dialy" would otherwise silently demote the post to a
      // regular article and surface it on the main list; fail fast instead.
      throw new Error(
        `${file}: unknown post type ${JSON.stringify(rawType)}; ` +
          `expected "daily" or "reading".`,
      );
    }
  }
  return {
    meta: {
      published,
      description:
        typeof data["description"] === "string" ? data["description"] : undefined,
      // jikji treated any non-empty "draft" string as a draft; keep that.
      draft: Boolean(data["draft"]),
      dark: Boolean(data["dark"]),
      type,
      book: parseBook(data["book"]),
    },
    body: source.slice(match[0].length),
  };
}

async function walkContent(): Promise<{
  files: { year: string; month: string; name: string; sourcePath: string }[];
  assets: PostAsset[];
}> {
  const files = [];
  const assets: PostAsset[] = [];
  for (const yearEntry of await fs.readdir(CONTENT_ROOT, {
    withFileTypes: true,
  })) {
    if (!yearEntry.isDirectory() || !/^20\d\d$/.test(yearEntry.name)) continue;
    const year = yearEntry.name;
    const yearDir = path.join(CONTENT_ROOT, year);
    for (const monthEntry of await fs.readdir(yearDir, {
      withFileTypes: true,
    })) {
      if (!monthEntry.isDirectory() || monthEntry.name.startsWith(".")) {
        continue;
      }
      const month = monthEntry.name;
      const monthDir = path.join(yearDir, month);
      for (const entry of await fs.readdir(monthDir, { withFileTypes: true })) {
        if (entry.name.startsWith(".")) continue;
        if (entry.isFile() && entry.name.endsWith(".md")) {
          files.push({
            year,
            month,
            name: entry.name,
            sourcePath: path.join(monthDir, entry.name),
          });
        } else if (entry.isDirectory()) {
          // Files sitting next to a post (images etc.), served under the
          // same URL path, like jikji's scanFiles over the year dirs did.
          const slugDir = path.join(monthDir, entry.name);
          for (const fileEntry of await fs.readdir(slugDir, {
            withFileTypes: true,
          })) {
            if (!fileEntry.isFile() || fileEntry.name.startsWith(".")) {
              continue;
            }
            assets.push({
              year,
              month,
              slug: entry.name,
              file: fileEntry.name,
              sourcePath: path.join(slugDir, fileEntry.name),
            });
          }
        }
      }
    }
  }
  return { files, assets };
}

// Rendering a ko-Kore file runs seonbi twice, and each seonbi call loads the
// kr-stdict dictionary (~130ms).  Cache rendered views per source file, keyed
// by mtime, so a request only re-renders the files that actually changed.
const viewCache = new Map<string, { mtimeMs: number; views: PostView[] }>();

async function renderFile(
  sourcePath: string,
  lang: string,
): Promise<PostView[]> {
  const { mtimeMs } = await fs.stat(sourcePath);
  const cached = viewCache.get(sourcePath);
  if (cached !== undefined && cached.mtimeMs === mtimeMs) return cached.views;

  const source = await fs.readFile(sourcePath, "utf-8");
  const { meta, body } = parseFrontMatter(source, sourcePath);
  const views: PostView[] = [];
  if (lang === "ko-Kore") {
    // A ko-Kore source yields two views: the original text with Hanja
    // rendered in ruby, and a derived Hangul-only ko-Hang view.
    views.push({
      lang: "ko-Kore",
      ...renderMarkdown(transform(seonbiConfiguration("HanjaInRuby"), body)),
      ...meta,
    });
    views.push({
      lang: "ko-Hang",
      ...renderMarkdown(transform(seonbiConfiguration("HangulOnly"), body)),
      ...meta,
    });
  } else {
    views.push({ lang, ...renderMarkdown(body), ...meta });
  }
  viewCache.set(sourcePath, { mtimeMs, views });
  return views;
}

async function load(): Promise<{ posts: Post[]; assets: PostAsset[] }> {
  const { files, assets } = await walkContent();
  const byPath = new Map<string, Post>();
  for (const file of files) {
    const match = file.name.match(
      /^(.+)\.([a-z]{2}(?:-[A-Za-z]{4})?)\.md$/,
    );
    if (match === null) {
      console.warn(`Skipping ${file.sourcePath}: no language suffix.`);
      continue;
    }
    const [, slug, lang] = match as unknown as [string, string, string];

    const postPath = `${file.year}/${file.month}/${slug}`;
    let post = byPath.get(postPath);
    if (post === undefined) {
      post = {
        path: postPath,
        year: file.year,
        month: file.month,
        slug,
        views: [],
        multiview: false,
      };
      byPath.set(postPath, post);
    }
    post.views.push(...(await renderFile(file.sourcePath, lang)));
  }

  const posts = [...byPath.values()];
  for (const post of posts) {
    // Like jikji, a ko-Kore source lists its original view before the derived
    // ko-Hang one; views from separate files are ordered alphabetically.
    const hasKore = post.views.some((v) => v.lang === "ko-Kore");
    const rank = (v: PostView): number =>
      hasKore ? (v.lang === "ko-Kore" ? 0 : v.lang === "ko-Hang" ? 1 : 2) : 0;
    post.views.sort(
      (a, b) => rank(a) - rank(b) || a.lang.localeCompare(b.lang, "en"),
    );
    post.multiview = post.views.length > 1;
  }
  return { posts, assets };
}

let cache: Promise<{ posts: Post[]; assets: PostAsset[] }> | undefined;

function loadCached(): Promise<{ posts: Post[]; assets: PostAsset[] }> {
  // In dev, reload on every request so content edits show up on refresh.
  if (import.meta.env.DEV) return load();
  cache ??= load();
  return cache;
}

export async function getPosts(): Promise<Post[]> {
  const { posts } = await loadCached();
  // Draft views are built in dev so they can be previewed at their URL, but
  // are excluded from the production build entirely (jikji only hid them
  // from the list page; its list.ejs carried a FIXME to exclude them fully).
  if (import.meta.env.DEV) return posts;
  return posts
    .map((post) => {
      const views = post.views.filter((view) => !view.draft);
      return { ...post, views, multiview: views.length > 1 };
    })
    .filter((post) => post.views.length > 0);
}

export async function getPost(postPath: string): Promise<Post> {
  const post = (await getPosts()).find((p) => p.path === postPath);
  if (post === undefined) throw new Error(`No such post: ${postPath}`);
  return post;
}

export async function getAssets(): Promise<PostAsset[]> {
  return (await loadCached()).assets;
}

const KST_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

/** Year/month/day of a date in Asia/Seoul, where the posts are authored. */
export function kstDate(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = KST_FORMAT.formatToParts(date);
  const get = (type: string): number =>
    Number(parts.find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day") };
}

/** The URL path of a language-specific view file, e.g. "index.ko-hang.html". */
export function viewFilename(lang: string): string {
  return `index.${lang.toLowerCase()}.html`;
}
