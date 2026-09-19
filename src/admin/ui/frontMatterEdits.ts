import type { BookInfo, FrontMatterForm } from "../lib/types.ts";

function isBlank(value: unknown): boolean {
  return value === undefined || value === false || value === "";
}

export function withFormField<Key extends keyof FrontMatterForm>(
  form: FrontMatterForm,
  key: Key,
  value: FrontMatterForm[Key],
): FrontMatterForm {
  const next = { ...form };
  if (isBlank(value)) delete next[key];
  else next[key] = value;
  return next;
}

function withBookYear(book: BookInfo, input: string): BookInfo {
  const next = { ...book };
  const year = Number.parseInt(input, 10);
  if (Number.isNaN(year)) delete next.year;
  else next.year = year;
  return next;
}

function withBookText(book: BookInfo, key: Exclude<keyof BookInfo, "year">, input: string): BookInfo {
  const next = { ...book };
  if (input === "") delete next[key];
  else next[key] = input;
  return next;
}

function hasNoFields(book: BookInfo): boolean {
  return Object.values(book).every((value) => value === undefined);
}

export function withBookField(
  form: FrontMatterForm,
  key: keyof BookInfo,
  input: string,
): FrontMatterForm {
  const current: BookInfo = { ...form.book };
  const book = key === "year" ? withBookYear(current, input) : withBookText(current, key, input);
  const next: FrontMatterForm = { ...form, book };
  if (hasNoFields(book)) delete next.book;
  return next;
}
