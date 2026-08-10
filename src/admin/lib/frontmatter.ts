import { parseFrontMatter } from "../../lib/posts.ts";
import type { BookInfo, FrontMatterForm, PostType } from "./types.ts";

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitSource(
  source: string,
  file: string,
): { fenceRaw: string; body: string } {
  const m = source.match(FENCE);
  if (m === null) throw new Error(`${file}: missing front matter.`);
  return { fenceRaw: m[0], body: source.slice(m[0].length) };
}

/**
 * Read front matter into the form's shape.  Goes through posts.ts's own parser
 * so the CMS can never disagree with the site about what a file means, but then
 * takes `published` verbatim from the text: posts.ts hands back a Date, and
 * re-formatting that would lose the exact `+09:00` spelling.
 */
export function readForm(source: string, file: string): FrontMatterForm {
  const { meta } = parseFrontMatter(source, file);
  const { fenceRaw } = splitSource(source, file);
  const raw = /^published:[ \t]*(.+?)[ \t]*$/m.exec(fenceRaw);
  const published = raw?.[1]?.replace(/^["']|["']$/g, "") ??
    meta.published.toISOString();
  const form: FrontMatterForm = { published };
  if (meta.description !== undefined) form.description = meta.description;
  if (meta.draft) form.draft = true;
  if (meta.dark) form.dark = true;
  if (meta.type !== undefined) form.type = meta.type;
  if (meta.book !== undefined) form.book = meta.book;
  return form;
}

/**
 * A scalar is emitted bare when YAML would read it back unchanged; anything
 * else gets double quotes.  JSON.stringify happens to produce a valid YAML
 * double-quoted scalar for this content.
 */
function scalar(value: string): string {
  const plain =
    value.length > 0 &&
    value === value.trim() &&
    !/[\n\r]/.test(value) &&
    !/^[-?:,[\]{}#&*!|>'"%@`]/.test(value) &&
    !value.includes(": ") &&
    !value.includes(" #") &&
    !/^(true|false|null|yes|no|on|off|~)$/i.test(value) &&
    !/^[-+]?[0-9.]+$/.test(value);
  return plain ? value : JSON.stringify(value);
}

function bookLines(book: BookInfo, scaffold: boolean): string[] {
  const out = ["book:"];
  const put = (key: string, v: string | number | undefined) => {
    if (v === undefined || v === "") return;
    out.push(`  ${key}: ${typeof v === "number" ? v : scalar(v)}`);
  };
  if (scaffold) {
    // Matches scripts/new-reading.sh byte for byte.  parseBook() in posts.ts
    // returns undefined when every value is nullish, so this stays inert.
    out.push("  title:", "  author:");
    return out;
  }
  put("title", book.title);
  put("author", book.author);
  put("translator", book.translator);
  put("publisher", book.publisher);
  put("year", book.year);
  return out.length === 1 ? [] : out;
}

/**
 * Serialise front matter including both fences.  Key order is fixed to the one
 * every existing post and both scaffold scripts already use, and false flags
 * are omitted entirely because no file in the corpus writes `draft: false`.
 */
export function serializeFrontMatter(fm: FrontMatterForm): string {
  const lines = [`published: ${fm.published}`];
  if (fm.description !== undefined && fm.description !== "") {
    lines.push(`description: ${scalar(fm.description)}`);
  }
  if (fm.draft) lines.push("draft: true");
  if (fm.dark) lines.push("dark: true");
  if (fm.type !== undefined) lines.push(`type: ${fm.type}`);
  if (fm.type === "reading") {
    const book = fm.book ?? {};
    lines.push(...bookLines(book, fm.bookScaffold === true));
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

function bookEquals(a: BookInfo | undefined, b: BookInfo | undefined): boolean {
  const keys = ["title", "author", "translator", "publisher", "year"] as const;
  return keys.every((k) => (a?.[k] ?? undefined) === (b?.[k] ?? undefined));
}

/**
 * Compare two front matter blocks by what posts.ts would make of them, not by
 * their bytes.  This is what lets a file keep its original spelling -- the
 * legacy `draft: "true"` strings, a quoted description, the exact timestamp
 * text -- when the form round-trips without being edited.
 */
export function frontMatterEquals(a: string, b: string): boolean {
  try {
    const pa = parseFrontMatter(a + "\n", "(a)").meta;
    const pb = parseFrontMatter(b + "\n", "(b)").meta;
    return (
      pa.published.getTime() === pb.published.getTime() &&
      pa.description === pb.description &&
      pa.draft === pb.draft &&
      pa.dark === pb.dark &&
      pa.type === pb.type &&
      bookEquals(pa.book, pb.book)
    );
  } catch {
    return false;
  }
}

/**
 * "2026-08-07T23:05:11+09:00" in Asia/Seoul regardless of the machine's zone.
 * scripts/get-now.sh uses local time and would be wrong abroad; on a KST
 * machine the output is identical.
 */
export function nowKstIso(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(now);
  const at = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return (
    `${at("year")}-${at("month")}-${at("day")}` +
    `T${at("hour")}:${at("minute")}:${at("second")}+09:00`
  );
}

/**
 * The same wall clock, but on `day` ("YYYY-MM-DD"): what a backdated post is
 * published at.  Cutting the day off a timestamp belongs beside the function
 * that spells the timestamp, so the offset cannot drift from the format.
 */
export function kstIsoOn(day: string, now: Date = new Date()): string {
  return day + nowKstIso(now).slice(10);
}

/**
 * Setext underline sized to display width, where a CJK character occupies two
 * columns -- the rule scripts/new-daily.sh implements and hongdown enforces.
 * Only a fallback: the scaffold writes an ATX heading and lets hongdown convert
 * it, which produces the same underline.
 */
export function setextUnderline(title: string, char = "="): string {
  let width = 0;
  for (const ch of title) {
    const cp = ch.codePointAt(0) ?? 0;
    width += cp < 0x80 ? 1 : 2;
  }
  return char.repeat(width);
}

export type { PostType };
