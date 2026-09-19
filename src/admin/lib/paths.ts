import { promises as fs } from "node:fs";
import path from "node:path";
import { CONTENT_ROOT } from "../../lib/content-root.ts";
import { LANGS } from "../shared/post-files.ts";
import type { Lang } from "./types.ts";

export { CONTENT_ROOT };

export class PathError extends Error {}

const MAX_PATH_LENGTH = 200;

const PLAIN_PATH_CHARACTERS = /^[A-Za-z0-9._/-]+$/;

const POST_DIR = /^(?<year>20\d\d)\/(?<month>\d{2})\/(?<slug>[A-Za-z0-9][A-Za-z0-9._-]*)$/;

const POST_FILE_NAME = new RegExp(`^(?<stem>.+)\\.(?<lang>${LANGS.join("|")})\\.md$`);

interface PostPathParts {
  year: string;
  month: string;
  slug: string;
}

export interface PostDirRef extends PostPathParts {
  rel: string;
  abs: string;
}

export interface PostFileRef extends PostPathParts {
  rel: string;
  abs: string;
  lang: Lang;
  /** "2026/02/career" */
  postPath: string;
}

export function isCalendarDate(value: string): boolean {
  if (!/^20\d\d-\d\d-\d\d$/.test(value)) return false;
  const midnightUtc = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(midnightUtc) && new Date(midnightUtc).toISOString().slice(0, 10) === value;
}

export function contentPath(rel: string, root: string = CONTENT_ROOT): string {
  return path.join(root, ...rel.split("/"));
}

function assertPlainRelativePath(rel: string): void {
  if (rel.length === 0 || rel.length > MAX_PATH_LENGTH) {
    throw new PathError("path is empty or too long");
  }
  if (!PLAIN_PATH_CHARACTERS.test(rel)) {
    throw new PathError("path contains a disallowed character");
  }
  if (rel.includes("..") || rel.startsWith("/") || rel.includes("//")) {
    throw new PathError("path is not repo-relative");
  }
}

function contentPathInsideRoot(rel: string): string {
  const abs = path.resolve(CONTENT_ROOT, rel);
  if (abs !== contentPath(rel) || !abs.startsWith(CONTENT_ROOT + path.sep)) {
    throw new PathError("path escapes the content root");
  }
  return abs;
}

function matchPostDir(postPath: string): PostPathParts | null {
  const groups = POST_DIR.exec(postPath)?.groups;
  if (groups === undefined) return null;
  const { year, month, slug } = groups;
  return { year, month, slug };
}

export function splitPostFileName(name: string): { stem: string; lang: Lang } | null {
  const groups = POST_FILE_NAME.exec(name)?.groups;
  if (groups === undefined) return null;
  return { stem: groups.stem, lang: groups.lang as Lang };
}

export function resolvePostFile(rel: string): PostFileRef {
  assertPlainRelativePath(rel);
  const fileName = splitPostFileName(rel);
  const parts = fileName === null ? null : matchPostDir(fileName.stem);
  if (fileName === null || parts === null) {
    throw new PathError("not a post path like 2026/02/slug.ko-Hang.md");
  }
  return {
    rel,
    abs: contentPathInsideRoot(rel),
    ...parts,
    lang: fileName.lang,
    postPath: fileName.stem,
  };
}

export function resolvePostDir(postPath: string): PostDirRef {
  assertPlainRelativePath(postPath);
  const parts = matchPostDir(postPath);
  if (parts === null) throw new PathError("not a post path like 2026/02/slug");
  return { rel: postPath, abs: contentPathInsideRoot(postPath), ...parts };
}

function leadingSegments(rel: string): string[][] {
  const segments = rel.split("/");
  return segments.map((_, index) => segments.slice(0, index + 1));
}

async function lstatOrNull(abs: string) {
  try {
    return await fs.lstat(abs);
  } catch {
    return null;
  }
}

export async function assertNoSymlink(rel: string, root: string = CONTENT_ROOT): Promise<void> {
  for (const segments of leadingSegments(rel)) {
    const existing = await lstatOrNull(path.join(root, ...segments));
    if (existing === null) return;
    if (existing.isSymbolicLink()) throw new PathError(`symlink in path: ${rel}`);
  }
}
