import { nowKstIso, serializeFrontMatter, setextUnderline } from "./frontmatter.ts";
import type { FrontMatterForm, Lang } from "./types.ts";

export type PostKind = "daily" | "reading" | "regular";

/**
 * Titles for daily notes, matching scripts/new-daily.sh -- month and day
 * unpadded, and the script's per-language wording.
 */
export function dailyTitle(iso: string, lang: Lang): string {
  const [date] = iso.split("T");
  const [y, m, d] = (date ?? "").split("-").map((n) => Number.parseInt(n, 10));
  if (lang === "en") return date ?? "";
  const unit = lang === "ko-Kore" ? ["年", "月", "日"] : ["년", "월", "일"];
  return `${y}${unit[0]} ${m}${unit[1]} ${d}${unit[2]}`;
}

export interface ScaffoldInput {
  kind: PostKind;
  lang: Lang;
  title?: string;
  publishedAt?: string;
  description?: string;
  draft?: boolean;
  dark?: boolean;
  book?: FrontMatterForm["book"];
}

export interface Scaffold {
  /** Full file text, front matter included. */
  source: string;
  /** Slug for a daily note is the ISO date; otherwise the caller's. */
  dateSlug: string;
  published: string;
  frontmatter: FrontMatterForm;
}

export function scaffold(input: ScaffoldInput): Scaffold {
  const published = input.publishedAt ?? nowKstIso();
  const dateSlug = published.split("T")[0] ?? "";

  const fm: FrontMatterForm = { published };
  if (input.description !== undefined && input.description !== "") {
    fm.description = input.description;
  }
  if (input.draft === true) fm.draft = true;
  if (input.dark === true) fm.dark = true;
  if (input.kind === "daily") fm.type = "daily";
  if (input.kind === "reading") {
    fm.type = "reading";
    if (input.book !== undefined) fm.book = input.book;
    // No book details yet: emit the same empty title:/author: pair
    // scripts/new-reading.sh writes.
    else fm.bookScaffold = true;
  }

  const title =
    input.kind === "daily"
      ? dailyTitle(published, input.lang)
      : (input.title ?? "TODO");

  // Setext directly rather than ATX: hongdown would convert an ATX heading to
  // exactly this, and writing it here keeps the file well-formed even when the
  // formatter is missing.
  const body = `${title}\n${setextUnderline(title)}\n`;
  return {
    source: serializeFrontMatter(fm) + "\n" + body,
    dateSlug,
    published,
    frontmatter: fm,
  };
}
