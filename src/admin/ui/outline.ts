export interface Heading {
  level: number;
  text: string;
  /** 1-based line where the heading starts. */
  line: number;
}

const ATX = /^ {0,3}(#{1,6})(?:[ \t]+(.*?))?(?:[ \t]+#+)?[ \t]*$/;
const SETEXT_UNDERLINE = /^ {0,3}(=+|-+)[ \t]*$/;
const FENCE = /^ {0,3}(`{3,}|~{3,})/;
const NOT_PARAGRAPH = /^ {0,3}(?:[>#|]|[-*+][ \t]|\d+[.)][ \t]|<)/;

/** Headings deeper than this crowd the outline more than they help. */
export const OUTLINE_DEPTH = 3;

export function plainHeadingText(markdown: string): string {
  return markdown
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/\[\^[^\]]+\]/g, "")
    .replace(/(?<!\\)\[([^\]]+)\]/g, "$1")
    .replace(/(?<!\\)[*_`~]+/g, "")
    .replace(/\\(.)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function isBlank(line: string): boolean {
  return line.trim() === "";
}

export function outlineOf(body: string): Heading[] {
  const lines = body.split("\n");
  const headings: Heading[] = [];
  let fence: string | null = null;
  let paragraphStart: number | null = null;

  lines.forEach((line, index) => {
    const opener = FENCE.exec(line)?.[1];
    if (fence !== null) {
      if (opener !== undefined && opener[0] === fence[0] && opener.length >= fence.length) fence = null;
      return;
    }
    if (opener !== undefined) {
      fence = opener;
      paragraphStart = null;
      return;
    }

    const underline = SETEXT_UNDERLINE.exec(line)?.[1];
    if (underline !== undefined && paragraphStart !== null) {
      const text = lines.slice(paragraphStart, index).join(" ");
      headings.push({ level: underline[0] === "=" ? 1 : 2, text: plainHeadingText(text), line: paragraphStart + 1 });
      paragraphStart = null;
      return;
    }

    const atx = ATX.exec(line);
    if (atx !== null) {
      headings.push({ level: atx[1]!.length, text: plainHeadingText(atx[2] ?? ""), line: index + 1 });
      paragraphStart = null;
      return;
    }

    if (isBlank(line) || NOT_PARAGRAPH.test(line)) paragraphStart = null;
    else paragraphStart ??= index;
  });

  return headings.filter((heading) => heading.level <= OUTLINE_DEPTH && heading.text !== "");
}

/**
 * The heading whose section holds `line`.  Above the first heading the first
 * one counts, since only the title or blank lines can sit there; -1 means
 * there are no headings at all.
 */
export function activeHeadingIndex(headings: Heading[], line: number): number {
  let active = headings.length > 0 ? 0 : -1;
  headings.forEach((heading, index) => {
    if (heading.line <= line) active = index;
  });
  return active;
}
