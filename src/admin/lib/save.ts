import { promises as fs } from "node:fs";
import path from "node:path";
import { formatMarkdown } from "./format.ts";
import {
  frontMatterEquals,
  serializeFrontMatter,
  splitSource,
} from "./frontmatter.ts";
import type { PostFileRef } from "./paths.ts";
import type { FrontMatterForm } from "./types.ts";

interface EditedPost {
  frontmatter: FrontMatterForm;
  fenceRaw?: string;
  body: string;
}

function preserveUnchangedFrontMatter(
  form: FrontMatterForm,
  original?: string,
): string {
  const serialized = serializeFrontMatter(form);
  return typeof original === "string" && frontMatterEquals(serialized, original)
    ? original
    : serialized;
}

function normalizeBodyLineEndings(body: string): string {
  return body.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");
}

export function composeSavedSource(post: EditedPost): string {
  const fence = preserveUnchangedFrontMatter(post.frontmatter, post.fenceRaw);
  return fence + "\n" + normalizeBodyLineEndings(post.body);
}

export async function replacePostFileAtomically(
  file: string,
  source: string,
): Promise<void> {
  const hiddenTemporaryFile = path.join(
    path.dirname(file),
    `.${path.basename(file)}.tmp`,
  );
  try {
    await fs.writeFile(hiddenTemporaryFile, source, "utf-8");
    await fs.rename(hiddenTemporaryFile, file);
  } catch (error) {
    await fs.rm(hiddenTemporaryFile, { force: true }).catch(() => {});
    throw error;
  }
}

export async function formatAndReadSavedPost(ref: PostFileRef, shouldFormat: boolean) {
  const result = shouldFormat ? await formatMarkdown(ref.abs) : { formatted: false };
  const sourceOnDisk = await fs.readFile(ref.abs, "utf-8");
  const { fenceRaw, body } = splitSource(sourceOnDisk, ref.rel);
  return {
    fenceRaw,
    body,
    mtimeMs: (await fs.stat(ref.abs)).mtimeMs,
    formatted: result.formatted,
    ...(result.warning !== undefined ? { formatterWarning: result.warning } : {}),
    ...(result.notices !== undefined ? { formatterNotices: result.notices } : {}),
  };
}
