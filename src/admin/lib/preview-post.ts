import { promises as fs } from "node:fs";
import path from "node:path";
import { sortPostViews, type Post, type PostView } from "../../lib/posts.ts";
import { derivedLangsOf } from "../shared/post-files.ts";
import { splitPostFileName, type PostFileRef } from "./paths.ts";
import type { Lang } from "./types.ts";

async function fileNamesIn(directory: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name);
  } catch {
    return [];
  }
}

export async function siblingViewLangs(ref: PostFileRef): Promise<Lang[]> {
  const ownFileName = path.basename(ref.abs);
  const siblingFileNames = (await fileNamesIn(path.dirname(ref.abs))).filter(
    (name) => name !== ownFileName,
  );
  return siblingFileNames.flatMap((name) => {
    const sibling = splitPostFileName(name);
    if (sibling === null || sibling.stem !== ref.slug) return [];
    return [sibling.lang, ...derivedLangsOf(sibling.lang)];
  });
}

function languageOnlyView(template: PostView, lang: Lang): PostView {
  return { ...template, lang, html: "" };
}

export function previewPost(
  ref: PostFileRef,
  bufferViews: PostView[],
  siblingLangs: Lang[],
): Post {
  const [template] = bufferViews;
  if (template === undefined) throw new Error("the buffer rendered no views.");
  const views = [
    ...bufferViews,
    ...siblingLangs.map((lang) => languageOnlyView(template, lang)),
  ];
  sortPostViews(views);
  return {
    path: ref.postPath,
    year: ref.year,
    month: ref.month,
    slug: ref.slug,
    views,
    multiview: views.length > 1,
  };
}

const HEAD_START_TAG = /<head(\s[^>]*)?>/i;

export function withBaseHref(html: string, postPath: string): string {
  const base = `<base href="/${postPath}/">`;
  const injected = html.replace(HEAD_START_TAG, (head) => head + base);
  if (injected === html) {
    console.warn("preview: no <head> to anchor relative asset paths to.");
  }
  return injected;
}
