import { promises as fs } from "node:fs";
import path from "node:path";
import MarkdownIt from "markdown-it";
import title from "markdown-it-title";
import {
  fileNames,
  postPathOf,
  walkContent,
  type AssetDirectory,
  type SourceFile,
} from "../../lib/posts.ts";
import { readForm, splitSource } from "./frontmatter.ts";
import { errorMessage } from "../shared/errors.ts";
import { LANGS, derivedLangsOf } from "../shared/post-files.ts";
import { CONTENT_ROOT, contentPath, splitPostFileName } from "./paths.ts";
import type { Lang, PostAssetInfo, PostGroup, PostSourceSummary } from "./types.ts";

interface PostSource {
  file: string;
  sourcePath: string;
  year: string;
  month: string;
  slug: string;
  lang: Lang;
}

type FrontMatterSummary = Pick<
  PostSourceSummary,
  "title" | "published" | "publishedMs" | "description" | "draft" | "dark" | "type" | "book"
>;

const sourceTitleParser = MarkdownIt("commonmark").use(title);

const NO_PUBLISHED_TIME = 0;

function publishedMsOf(published: string): number {
  const ms = new Date(published).getTime();
  return Number.isNaN(ms) ? NO_PUBLISHED_TIME : ms;
}

export function firstHeading(body: string): string {
  const env: { title?: string } = {};
  sourceTitleParser.render(body, env);
  return env.title ?? "";
}

function postSourceOf(sourceFile: SourceFile): PostSource | null {
  const fileName = splitPostFileName(sourceFile.name);
  if (fileName === null) return null;
  const { year, month, name, sourcePath } = sourceFile;
  return {
    file: `${year}/${month}/${name}`,
    sourcePath,
    year,
    month,
    slug: fileName.stem,
    lang: fileName.lang,
  };
}

function frontMatterSummary(text: string, file: string): FrontMatterSummary {
  const form = readForm(text, file);
  const { body } = splitSource(text, file);
  return {
    title: firstHeading(body),
    published: form.published,
    publishedMs: publishedMsOf(form.published),
    ...(form.description !== undefined ? { description: form.description } : {}),
    draft: form.draft === true,
    dark: form.dark === true,
    ...(form.type !== undefined ? { type: form.type } : {}),
    ...(form.book !== undefined ? { book: form.book } : {}),
  };
}

async function summarize(source: PostSource): Promise<PostSourceSummary> {
  const stat = await fs.stat(source.sourcePath);
  const summaryWithoutFrontMatter: PostSourceSummary = {
    file: source.file,
    postPath: postPathOf(source),
    year: source.year,
    month: source.month,
    slug: source.slug,
    lang: source.lang,
    title: "",
    published: "",
    publishedMs: NO_PUBLISHED_TIME,
    draft: false,
    dark: false,
    derivedLangs: derivedLangsOf(source.lang),
    bytes: stat.size,
    mtimeMs: stat.mtimeMs,
  };
  const text = await fs.readFile(source.sourcePath, "utf-8");
  try {
    return { ...summaryWithoutFrontMatter, ...frontMatterSummary(text, source.file) };
  } catch (error) {
    return { ...summaryWithoutFrontMatter, parseError: errorMessage(error) };
  }
}

function findOrAddGroup(groupsByPostPath: Map<string, PostGroup>, source: PostSource): PostGroup {
  const postPath = postPathOf(source);
  let group = groupsByPostPath.get(postPath);
  if (group === undefined) {
    group = {
      postPath,
      year: source.year,
      month: source.month,
      slug: source.slug,
      sources: [],
      missingLangs: [],
      assetDir: null,
      assetCount: 0,
    };
    groupsByPostPath.set(postPath, group);
  }
  return group;
}

async function groupSourcesByPost(sourceFiles: SourceFile[]): Promise<PostGroup[]> {
  const groupsByPostPath = new Map<string, PostGroup>();
  for (const sourceFile of sourceFiles) {
    const source = postSourceOf(sourceFile);
    if (source === null) continue;
    const summary = await summarize(source);
    findOrAddGroup(groupsByPostPath, source).sources.push(summary);
  }
  return [...groupsByPostPath.values()];
}

function byLanguageTag(a: PostSourceSummary, b: PostSourceSummary): number {
  return a.lang.localeCompare(b.lang, "en");
}

function missingLangsOf(sources: PostSourceSummary[]): Lang[] {
  const present = new Set(sources.map((source) => source.lang));
  return LANGS.filter((lang) => !present.has(lang));
}

function assetCountsByPostPath(assetDirectories: AssetDirectory[]): Map<string, number> {
  return new Map(
    assetDirectories.map((directory) => [postPathOf(directory), directory.assets.length]),
  );
}

function withLanguagesAndAssets(group: PostGroup, assetCount: number | undefined): PostGroup {
  const sources = [...group.sources].sort(byLanguageTag);
  return {
    ...group,
    sources,
    missingLangs: missingLangsOf(sources),
    assetDir: assetCount === undefined ? null : group.postPath,
    assetCount: assetCount ?? 0,
  };
}

function firstListedPublishedMs(group: PostGroup): number {
  return group.sources[0]?.publishedMs ?? NO_PUBLISHED_TIME;
}

export async function scanPosts(root: string = CONTENT_ROOT): Promise<PostGroup[]> {
  const { files, assetDirectories } = await walkContent(root);
  const assetCounts = assetCountsByPostPath(assetDirectories);
  const groups = (await groupSourcesByPost(files)).map((group) =>
    withLanguagesAndAssets(group, assetCounts.get(group.postPath)),
  );
  return groups.sort((a, b) => firstListedPublishedMs(b) - firstListedPublishedMs(a));
}

async function assetsWithSizes(directory: string): Promise<PostAssetInfo[]> {
  const assets: PostAssetInfo[] = [];
  for (const file of await fileNames(directory)) {
    const { size } = await fs.stat(path.join(directory, file));
    assets.push({ file, bytes: size });
  }
  return assets;
}

export async function listAssets(
  postPath: string,
  root: string = CONTENT_ROOT,
): Promise<PostAssetInfo[]> {
  try {
    return await assetsWithSizes(contentPath(postPath, root));
  } catch {
    return [];
  }
}

export async function listAssetNames(
  postPath: string,
  root: string = CONTENT_ROOT,
): Promise<string[]> {
  return (await listAssets(postPath, root)).map((asset) => asset.file);
}
