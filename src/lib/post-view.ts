import type { BookInfo, PostView } from "./posts.ts";

const DEFAULT_DESCRIPTION = "블로그 포스트";

export function primaryLanguage(lang: string): string {
  return lang.split("-")[0] ?? lang;
}

export function descriptionOf(view: PostView): string {
  return view.description || DEFAULT_DESCRIPTION;
}

export function backLinkHref(view: PostView): string {
  return view.type === "daily" ? "/daily/" : "/";
}

export function bookLine(book: BookInfo): string {
  return [
    book.author,
    book.translator && `${book.translator} 옮김`,
    book.publisher,
    book.year !== undefined ? String(book.year) : undefined,
  ].filter((part): part is string => typeof part === "string").join(" · ");
}
