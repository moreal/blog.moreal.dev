import { load as loadYaml } from "js-yaml";
import {
  parseFrontMatter,
  splitFrontMatter,
  type FrontMatter,
} from "../../lib/posts.ts";
import type { BookInfo, FrontMatterForm } from "./types.ts";

export function splitSource(
  source: string,
  file: string,
): { fenceRaw: string; body: string } {
  const { fence, body } = splitFrontMatter(source, file);
  return { fenceRaw: fence, body };
}

const PUBLISHED_LINE = /^published:[ \t]*(.+?)[ \t]*$/m;
const SURROUNDING_QUOTES = /^["']|["']$/g;

function publishedAsWritten(fence: string): string | undefined {
  return PUBLISHED_LINE.exec(fence)?.[1]?.replace(SURROUNDING_QUOTES, "");
}

export function readForm(source: string, file: string): FrontMatterForm {
  const { meta } = parseFrontMatter(source, file);
  const { fence } = splitFrontMatter(source, file);
  const form: FrontMatterForm = {
    published: publishedAsWritten(fence) ?? meta.published.toISOString(),
  };
  if (meta.description !== undefined) form.description = meta.description;
  if (meta.draft) form.draft = true;
  if (meta.dark) form.dark = true;
  if (meta.type !== undefined) form.type = meta.type;
  if (meta.book !== undefined) form.book = meta.book;
  return form;
}

const LINE_BREAK = /[\n\r]/;
const YAML_INDICATOR_AT_START = /^[-?:,[\]{}#&*!|>'"%@`]/;
const YAML_MAPPING_SEPARATOR = ": ";
const YAML_COMMENT_START = " #";
const YAML_BOOLEAN_OR_NULL = /^(true|false|null|yes|no|on|off|~)$/i;
const YAML_NUMBER_LIKE = /^[-+]?[0-9.]+$/;
const PROBE_KEY = "value";

function parsedByYaml(value: string): unknown {
  try {
    return (loadYaml(`${PROBE_KEY}: ${value}`) as Record<string, unknown> | null)
      ?.[PROBE_KEY];
  } catch {
    return undefined;
  }
}

function readsBackUnchangedAsPlainYaml(value: string): boolean {
  return (
    value.length > 0 &&
    value === value.trim() &&
    !LINE_BREAK.test(value) &&
    !YAML_INDICATOR_AT_START.test(value) &&
    !value.includes(YAML_MAPPING_SEPARATOR) &&
    !value.includes(YAML_COMMENT_START) &&
    !YAML_BOOLEAN_OR_NULL.test(value) &&
    !YAML_NUMBER_LIKE.test(value) &&
    parsedByYaml(value) === value
  );
}

function yamlDoubleQuoted(value: string): string {
  return JSON.stringify(value);
}

function yamlScalar(value: string): string {
  return readsBackUnchangedAsPlainYaml(value) ? value : yamlDoubleQuoted(value);
}

const BOOK_FIELDS = ["title", "author", "translator", "publisher", "year"] as const;

const NEW_READING_SCRIPT_BOOK_LINES = ["book:", "  title:", "  author:"];

function bookFieldValue(value: string | number): string {
  return typeof value === "number" ? String(value) : yamlScalar(value);
}

function bookLines(book: BookInfo): string[] {
  const fieldLines = BOOK_FIELDS.flatMap((field) => {
    const value = book[field];
    return value === undefined || value === ""
      ? []
      : [`  ${field}: ${bookFieldValue(value)}`];
  });
  return fieldLines.length === 0 ? [] : ["book:", ...fieldLines];
}

export function serializeFrontMatter(form: FrontMatterForm): string {
  const lines = [`published: ${form.published}`];
  if (form.description !== undefined && form.description !== "") {
    lines.push(`description: ${yamlScalar(form.description)}`);
  }
  if (form.draft) lines.push("draft: true");
  if (form.dark) lines.push("dark: true");
  if (form.type !== undefined) lines.push(`type: ${form.type}`);
  if (form.type === "reading") {
    lines.push(
      ...(form.bookScaffold === true
        ? NEW_READING_SCRIPT_BOOK_LINES
        : bookLines(form.book ?? {})),
    );
  }
  return `---\n${lines.join("\n")}\n---\n`;
}

function sameBook(a: BookInfo | undefined, b: BookInfo | undefined): boolean {
  return BOOK_FIELDS.every((field) => a?.[field] === b?.[field]);
}

function sameMeaning(a: FrontMatter, b: FrontMatter): boolean {
  return (
    a.published.getTime() === b.published.getTime() &&
    a.description === b.description &&
    a.draft === b.draft &&
    a.dark === b.dark &&
    a.type === b.type &&
    sameBook(a.book, b.book)
  );
}

export function parsesToSameFrontMatter(a: string, b: string): boolean {
  try {
    return sameMeaning(
      parseFrontMatter(a, "(a)").meta,
      parseFrontMatter(b, "(b)").meta,
    );
  } catch {
    return false;
  }
}
