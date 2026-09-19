import type { Lang } from "../lib/types.ts";

export const LANGS: Lang[] = ["ko-Hang", "ko-Kore", "en"];

export const CREATE_SLUG = /^[a-z0-9][a-z0-9-]*$/;

export function postFileName(slug: string, lang: Lang): string {
  return `${slug}.${lang}.md`;
}

export function derivedLangsOf(sourceLang: Lang): Lang[] {
  return sourceLang === "ko-Kore" ? ["ko-Hang"] : [];
}
