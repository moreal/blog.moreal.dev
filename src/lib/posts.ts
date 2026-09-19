import {
  transform,
  type Configuration,
  type HanjaRenderingOption,
} from "@seonbi/node";
import { load as loadYaml } from "js-yaml";
import MarkdownIt from "markdown-it";
import footnote from "markdown-it-footnote";
import title from "markdown-it-title";
import { promises as fs, type Dirent } from "node:fs";
import path from "node:path";
import { CONTENT_ROOT } from "./content-root.ts";

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

export interface FrontMatter {
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

export interface PostView extends FrontMatter {
  /** Language tag, e.g. "ko-Hang", "ko-Kore", "en". */
  lang: string;
  /** Rendered HTML body. */
  html: string;
  /** Title extracted from the first heading of the document. */
  title: string;
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

export interface SourceFile {
  year: string;
  month: string;
  name: string;
  sourcePath: string;
}

export interface AssetDirectory {
  year: string;
  month: string;
  slug: string;
  assets: PostAsset[];
}

interface ContentFiles {
  files: SourceFile[];
  assetDirectories: AssetDirectory[];
}

interface Content {
  posts: Post[];
  assets: PostAsset[];
}

const FRONT_MATTER_FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontMatter(
  source: string,
  file: string,
): { fence: string; yaml: string; body: string } {
  const match = FRONT_MATTER_FENCE.exec(source);
  if (match === null) throw new Error(`${file}: missing front matter.`);
  return {
    fence: match[0],
    yaml: match[1]!,
    body: source.slice(match[0].length),
  };
}

function stringField(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function parsePublished(value: unknown, file: string): Date {
  const published = value instanceof Date
    ? value
    : typeof value === "string"
    ? new Date(value)
    : undefined;
  if (published === undefined || Number.isNaN(published.getTime())) {
    throw new Error(`${file}: front matter lacks a "published" timestamp.`);
  }
  return published;
}

function parsePostType(value: unknown, file: string): PostType | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === "daily" || value === "reading") return value;
  throw new Error(
    `${file}: unknown post type ${JSON.stringify(value)}; ` +
      `expected "daily" or "reading".`,
  );
}

function parseBook(value: unknown): BookInfo | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const record = value as Record<string, unknown>;
  const book: BookInfo = {
    title: stringField(record, "title"),
    author: stringField(record, "author"),
    translator: stringField(record, "translator"),
    publisher: stringField(record, "publisher"),
    year: typeof record["year"] === "number" ? record["year"] : undefined,
  };
  const hasAnyField = Object.values(book).some((field) => field !== undefined);
  return hasAnyField ? book : undefined;
}

export function parseFrontMatter(
  source: string,
  file: string,
): { meta: FrontMatter; body: string } {
  const { yaml, body } = splitFrontMatter(source, file);
  const data = (loadYaml(yaml) ?? {}) as Record<string, unknown>;
  return {
    meta: {
      published: parsePublished(data["published"], file),
      description: stringField(data, "description"),
      draft: Boolean(data["draft"]),
      dark: Boolean(data["dark"]),
      type: parsePostType(data["type"], file),
      book: parseBook(data["book"]),
    },
    body,
  };
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

const VIEWS_OF_KORE_SOURCE: {
  lang: string;
  hanjaRendering: HanjaRenderingOption;
}[] = [
  { lang: "ko-Kore", hanjaRendering: "HanjaInRuby" },
  { lang: "ko-Hang", hanjaRendering: "HangulOnly" },
];

export function renderViews(
  source: string,
  lang: string,
  file = "(buffer)",
): PostView[] {
  const { meta, body } = parseFrontMatter(source, file);
  if (lang !== "ko-Kore") return [{ lang, ...renderMarkdown(body), ...meta }];
  return VIEWS_OF_KORE_SOURCE.map((view) => ({
    lang: view.lang,
    ...renderMarkdown(transform(seonbiConfiguration(view.hanjaRendering), body)),
    ...meta,
  }));
}

export function sortPostViews(views: PostView[]): void {
  const hasKoreSource = views.some((view) => view.lang === "ko-Kore");
  const rank = (view: PostView): number => {
    if (!hasKoreSource) return 0;
    if (view.lang === "ko-Kore") return 0;
    if (view.lang === "ko-Hang") return 1;
    return 2;
  };
  views.sort((a, b) => rank(a) - rank(b) || a.lang.localeCompare(b.lang, "en"));
}

async function visibleEntries(directory: string): Promise<Dirent[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  return entries.filter((entry) => !entry.name.startsWith("."));
}

async function directoryNames(directory: string): Promise<string[]> {
  return (await visibleEntries(directory))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);
}

export async function fileNames(directory: string): Promise<string[]> {
  return (await visibleEntries(directory))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name);
}

const YEAR_DIRECTORY = /^20\d\d$/;

export async function walkContent(root: string): Promise<ContentFiles> {
  const found: ContentFiles = { files: [], assetDirectories: [] };
  for (const year of await directoryNames(root)) {
    if (!YEAR_DIRECTORY.test(year)) continue;
    for (const month of await directoryNames(path.join(root, year))) {
      const inMonth = await walkMonth(path.join(root, year, month), year, month);
      found.files.push(...inMonth.files);
      found.assetDirectories.push(...inMonth.assetDirectories);
    }
  }
  return found;
}

async function walkMonth(
  directory: string,
  year: string,
  month: string,
): Promise<ContentFiles> {
  const found: ContentFiles = { files: [], assetDirectories: [] };
  for (const entry of await visibleEntries(directory)) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isFile() && entry.name.endsWith(".md")) {
      found.files.push({ year, month, name: entry.name, sourcePath: entryPath });
    } else if (entry.isDirectory()) {
      const slug = entry.name;
      const assets = (await fileNames(entryPath)).map((file) => ({
        year,
        month,
        slug,
        file,
        sourcePath: path.join(entryPath, file),
      }));
      found.assetDirectories.push({ year, month, slug, assets });
    }
  }
  return found;
}

const SOURCE_FILE_NAME = /^(.+)\.([a-z]{2}(?:-[A-Za-z]{4})?)\.md$/;

export function parseSourceFileName(
  name: string,
): { slug: string; lang: string } | undefined {
  const match = SOURCE_FILE_NAME.exec(name);
  if (match === null) return undefined;
  return { slug: match[1]!, lang: match[2]! };
}

// Each seonbi call reloads the kr-stdict dictionary (~130ms) and a ko-Kore
// source needs two, so a file is rendered again only when its mtime changes.
const renderedViewsBySource = new Map<
  string,
  { mtimeMs: number; views: PostView[] }
>();

async function renderFile(
  sourcePath: string,
  lang: string,
): Promise<PostView[]> {
  const { mtimeMs } = await fs.stat(sourcePath);
  const cached = renderedViewsBySource.get(sourcePath);
  if (cached !== undefined && cached.mtimeMs === mtimeMs) return cached.views;

  const source = await fs.readFile(sourcePath, "utf-8");
  const views = renderViews(source, lang, sourcePath);
  renderedViewsBySource.set(sourcePath, { mtimeMs, views });
  return views;
}

export function postPathOf({ year, month, slug }: { year: string; month: string; slug: string }): string {
  return `${year}/${month}/${slug}`;
}

function findOrAddPost(
  postsByPath: Map<string, Post>,
  year: string,
  month: string,
  slug: string,
): Post {
  const postPath = postPathOf({ year, month, slug });
  let post = postsByPath.get(postPath);
  if (post === undefined) {
    post = { path: postPath, year, month, slug, views: [], multiview: false };
    postsByPath.set(postPath, post);
  }
  return post;
}

async function loadContent(): Promise<Content> {
  const { files, assetDirectories } = await walkContent(CONTENT_ROOT);
  const postsByPath = new Map<string, Post>();
  for (const file of files) {
    const name = parseSourceFileName(file.name);
    if (name === undefined) {
      console.warn(`Skipping ${file.sourcePath}: no language suffix.`);
      continue;
    }
    const post = findOrAddPost(postsByPath, file.year, file.month, name.slug);
    post.views.push(...(await renderFile(file.sourcePath, name.lang)));
  }

  const posts = [...postsByPath.values()];
  for (const post of posts) {
    sortPostViews(post.views);
    post.multiview = post.views.length > 1;
  }
  const assets = assetDirectories.flatMap((directory) => directory.assets);
  return { posts, assets };
}

let contentCache: Promise<Content> | undefined;

function cachedContent(): Promise<Content> {
  if (import.meta.env.DEV) return loadContent();
  contentCache ??= loadContent();
  return contentCache;
}

export function withoutDrafts(posts: Post[]): Post[] {
  return posts
    .map((post) => {
      const views = post.views.filter((view) => !view.draft);
      return { ...post, views, multiview: views.length > 1 };
    })
    .filter((post) => post.views.length > 0);
}

export async function getPosts(): Promise<Post[]> {
  const { posts } = await cachedContent();
  const previewingDrafts = import.meta.env.DEV;
  return previewingDrafts ? posts : withoutDrafts(posts);
}

export async function getPost(postPath: string): Promise<Post> {
  const post = (await getPosts()).find((candidate) => candidate.path === postPath);
  if (post === undefined) throw new Error(`No such post: ${postPath}`);
  return post;
}

export async function getAssets(): Promise<PostAsset[]> {
  return (await cachedContent()).assets;
}

const KST_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "numeric",
  day: "numeric",
});

export function kstDate(date: Date): {
  year: number;
  month: number;
  day: number;
} {
  const parts = KST_FORMAT.formatToParts(date);
  const numericPart = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value);
  return {
    year: numericPart("year"),
    month: numericPart("month"),
    day: numericPart("day"),
  };
}

export function viewFilename(lang: string): string {
  return `index.${lang.toLowerCase()}.html`;
}

export function viewUrl(postPath: string, lang: string): string {
  return `/${postPath}/${viewFilename(lang)}`;
}
