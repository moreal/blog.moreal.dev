import type { Lang } from "../lib/types.ts";

export function editorHref(file: string): string {
  return `/admin/edit?file=${encodeURIComponent(file)}`;
}

export function newTranslationHref(postPath: string, lang: Lang): string {
  return `/admin/new?translationOf=${encodeURIComponent(postPath)}&lang=${lang}`;
}

export function publishedPostHref(postPath: string): string {
  return `/${postPath}/`;
}
