import { serializeFrontMatter } from "./frontmatter.ts";
import { calendarDateOf, nowKstIso } from "../shared/dates.ts";
import type { BookInfo, FrontMatterForm, Lang } from "./types.ts";

export type PostKind = "daily" | "reading" | "regular";

export interface ScaffoldInput {
  kind: PostKind;
  lang: Lang;
  title?: string;
  publishedAt?: string;
  description?: string;
  draft?: boolean;
  dark?: boolean;
  book?: BookInfo;
}

const UNTITLED_HEADING = "TODO";

const DATE_UNITS: Record<Exclude<Lang, "en">, readonly [year: string, month: string, day: string]> = {
  "ko-Hang": ["년", "월", "일"],
  "ko-Kore": ["年", "月", "日"],
};

function unpadded(digits: string): number {
  return Number.parseInt(digits, 10);
}

function dailyTitle(iso: string, lang: Lang): string {
  const calendarDate = calendarDateOf(iso);
  if (lang === "en") return calendarDate;
  const [year, month, day] = calendarDate.split("-").map(unpadded);
  const [yearUnit, monthUnit, dayUnit] = DATE_UNITS[lang];
  return `${year}${yearUnit} ${month}${monthUnit} ${day}${dayUnit}`;
}

function headingFor(input: ScaffoldInput, published: string): string {
  return input.kind === "daily"
    ? dailyTitle(published, input.lang)
    : (input.title ?? UNTITLED_HEADING);
}

function isAscii(character: string): boolean {
  return (character.codePointAt(0) ?? 0) < 0x80;
}

function displayColumns(text: string): number {
  return [...text].reduce(
    (columns, character) => columns + (isAscii(character) ? 1 : 2),
    0,
  );
}

function setextHeading(title: string): string {
  return `${title}\n${"=".repeat(displayColumns(title))}\n`;
}

function frontMatterForKind(kind: PostKind, book: BookInfo | undefined): Partial<FrontMatterForm> {
  switch (kind) {
    case "daily":
      return { type: "daily" };
    case "reading":
      return book === undefined
        ? { type: "reading", bookScaffold: true }
        : { type: "reading", book };
    case "regular":
      return {};
  }
}

function frontMatterFor(input: ScaffoldInput, published: string): FrontMatterForm {
  return {
    published,
    description: input.description,
    draft: input.draft === true,
    dark: input.dark === true,
    ...frontMatterForKind(input.kind, input.book),
  };
}

export function scaffoldSource(input: ScaffoldInput): string {
  const published = input.publishedAt ?? nowKstIso();
  return (
    serializeFrontMatter(frontMatterFor(input, published)) +
    "\n" +
    setextHeading(headingFor(input, published))
  );
}
