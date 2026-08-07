import { promises as fs } from "node:fs";
import path from "node:path";
import type { Lang } from "./types.ts";

/** Same assumption as src/lib/posts.ts: astro is always run from the repo root. */
export const CONTENT_ROOT = process.cwd();

export const LANGS: Lang[] = ["ko-Hang", "ko-Kore", "en"];

export class PathError extends Error {}

/**
 * Post files as they exist on disk.  Deliberately looser than CREATE_SLUG so
 * legacy names stay openable.
 */
const POST_FILE =
  /^(20\d\d)\/(\d{2})\/([A-Za-z0-9][A-Za-z0-9._-]*)\.(ko-Hang|ko-Kore|en)\.md$/;

const ASSET_FILE =
  /^(20\d\d)\/(\d{2})\/([A-Za-z0-9][A-Za-z0-9._-]*)\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

const POST_DIR = /^(20\d\d)\/(\d{2})\/([A-Za-z0-9][A-Za-z0-9._-]*)$/;

/** Stricter than the read patterns, so new slugs stay in the house style. */
export const CREATE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Everything outside this set is rejected before any regex runs, which is what
 * makes traversal structurally impossible rather than merely unlikely: it kills
 * backslashes, percent-encoding (`..%2f`), absolute paths and NUL truncation in
 * one step.
 */
function assertSafe(rel: string): void {
  if (rel.length === 0 || rel.length > 200) {
    throw new PathError("path is empty or too long");
  }
  if (!/^[A-Za-z0-9._/-]+$/.test(rel)) {
    throw new PathError("path contains a disallowed character");
  }
  if (rel.includes("..") || rel.startsWith("/") || rel.includes("//")) {
    throw new PathError("path is not repo-relative");
  }
}

/** Resolve and re-verify containment even after the allowlist above. */
function resolve(rel: string): string {
  const abs = path.resolve(CONTENT_ROOT, rel);
  const expected = path.join(CONTENT_ROOT, ...rel.split("/"));
  if (abs !== expected || !abs.startsWith(CONTENT_ROOT + path.sep)) {
    throw new PathError("path escapes the content root");
  }
  return abs;
}

export interface PostFileRef {
  rel: string;
  abs: string;
  year: string;
  month: string;
  slug: string;
  lang: Lang;
  /** "2026/02/career" */
  postPath: string;
}

export function resolvePostFile(rel: string): PostFileRef {
  assertSafe(rel);
  const m = POST_FILE.exec(rel);
  if (m === null) {
    throw new PathError("not a post path like 2026/02/slug.ko-Hang.md");
  }
  const [, year, month, slug, lang] = m as unknown as [
    string,
    string,
    string,
    string,
    Lang,
  ];
  return {
    rel,
    abs: resolve(rel),
    year,
    month,
    slug,
    lang,
    postPath: `${year}/${month}/${slug}`,
  };
}

export function resolvePostDir(postPath: string): {
  rel: string;
  abs: string;
  year: string;
  month: string;
  slug: string;
} {
  assertSafe(postPath);
  const m = POST_DIR.exec(postPath);
  if (m === null) throw new PathError("not a post path like 2026/02/slug");
  const [, year, month, slug] = m as unknown as [
    string,
    string,
    string,
    string,
  ];
  return { rel: postPath, abs: resolve(postPath), year, month, slug };
}

export function resolveAssetFile(rel: string): {
  rel: string;
  abs: string;
  postPath: string;
  file: string;
} {
  assertSafe(rel);
  const m = ASSET_FILE.exec(rel);
  if (m === null) throw new PathError("not an asset path");
  const [, year, month, slug, file] = m as unknown as [
    string,
    string,
    string,
    string,
    string,
  ];
  return { rel, abs: resolve(rel), postPath: `${year}/${month}/${slug}`, file };
}

/**
 * Refuse to write through a symlinked ancestor.  Cheap, one-time, and it closes
 * the one hole the string checks above cannot see.
 */
export async function assertNoSymlink(rel: string): Promise<void> {
  const parts = rel.split("/");
  for (let i = 1; i <= parts.length; i++) {
    const abs = path.join(CONTENT_ROOT, ...parts.slice(0, i));
    try {
      const st = await fs.lstat(abs);
      if (st.isSymbolicLink()) throw new PathError(`symlink in path: ${rel}`);
    } catch (e) {
      if (e instanceof PathError) throw e;
      return; // Does not exist yet; nothing to follow.
    }
  }
}

export function postFileName(slug: string, lang: Lang): string {
  return `${slug}.${lang}.md`;
}
