import type { Lang, PostKind } from "../lib/types.ts";

export const LANGS: Lang[] = ["ko-Hang", "ko-Kore", "en"];

export const POST_KINDS: PostKind[] = ["daily", "reading", "regular"];

export const CREATE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function postFileName(slug: string, lang: Lang): string {
  return `${slug}.${lang}.md`;
}

export function postFilePath(
  monthDirectory: { year: string; month: string },
  slug: string,
  lang: Lang,
): string {
  return `${monthDirectory.year}/${monthDirectory.month}/${postFileName(slug, lang)}`;
}

export function derivedLangsOf(sourceLang: Lang): Lang[] {
  return sourceLang === "ko-Kore" ? ["ko-Hang"] : [];
}
