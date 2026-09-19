import { promises as fs } from "node:fs";
import path from "node:path";
import { readForm, splitSource } from "./frontmatter.ts";
import { calendarDateOf, kstIsoOn, nowKstIso } from "../shared/dates.ts";
import { CREATE_SLUG, LANGS, postFileName } from "../shared/post-files.ts";
import { isCalendarDate, resolvePostDir } from "./paths.ts";
import { POST_KINDS, type PostKind, type ScaffoldInput } from "./scaffold.ts";
import type { FrontMatterForm, Lang } from "./types.ts";

export interface CreateRequest {
  kind: PostKind;
  lang: Lang;
  slug?: string;
  title?: string;
  /** "YYYY-MM-DD"; absent or empty means today in Seoul. */
  date?: string;
  description?: string;
  draft?: boolean;
  dark?: boolean;
  book?: FrontMatterForm["book"];
  /** Post path of an existing post to translate, e.g. "2026/02/foo". */
  translationOf?: string;
}

interface TranslationSource {
  form: FrontMatterForm;
  heading: string;
}

interface CreationPlan {
  year: string;
  month: string;
  slug: string;
  input: ScaffoldInput;
}

interface CreationFailure {
  ok: false;
  error: "bad-request" | "bad-name" | "not-found";
  message: string;
}

export type CreationPlanResult = { ok: true; plan: CreationPlan } | CreationFailure;

export function unknownLangOrKindMessage(req: CreateRequest): string | null {
  if (!LANGS.includes(req.lang)) return `unknown language ${JSON.stringify(req.lang)}`;
  if (!POST_KINDS.includes(req.kind)) return `unknown kind ${JSON.stringify(req.kind)}`;
  return null;
}

function failure(error: CreationFailure["error"], message: string): CreationFailure {
  return { ok: false, error, message };
}

function publicationTimeOn(requestedDay: string, now: Date): string {
  return requestedDay === "" ? nowKstIso(now) : kstIsoOn(requestedDay, now);
}

function validSlugFor(req: CreateRequest, publicationDay: string): string | null {
  if (req.kind === "daily") return publicationDay;
  return req.slug !== undefined && CREATE_SLUG.test(req.slug) ? req.slug : null;
}

export function planNewPost(req: CreateRequest, now: Date = new Date()): CreationPlanResult {
  const requestedDay = req.date ?? "";
  if (requestedDay !== "" && !isCalendarDate(requestedDay)) {
    return failure("bad-request", "날짜는 실제로 있는 YYYY-MM-DD 여야 합니다.");
  }
  const publishedAt = publicationTimeOn(requestedDay, now);
  const publicationDay = calendarDateOf(publishedAt);
  const slug = validSlugFor(req, publicationDay);
  if (slug === null) {
    return failure("bad-name", "슬러그는 영소문자·숫자·하이픈만 쓸 수 있습니다.");
  }
  return {
    ok: true,
    plan: {
      year: publicationDay.slice(0, 4),
      month: publicationDay.slice(5, 7),
      slug,
      input: { ...req, publishedAt },
    },
  };
}

export function planTranslation(
  req: CreateRequest,
  postPath: string,
  original: TranslationSource | null,
): CreationPlanResult {
  const { year, month, slug } = resolvePostDir(postPath);
  if (original === null) return failure("not-found", `${postPath} 에 원본이 없습니다.`);
  const title = req.title ?? (original.heading === "" ? undefined : original.heading);
  const input: ScaffoldInput = {
    ...req,
    publishedAt: original.form.published,
    kind: original.form.type ?? "regular",
    ...(original.form.dark === true ? { dark: true } : {}),
    ...(original.form.book !== undefined ? { book: original.form.book } : {}),
    ...(title !== undefined ? { title } : {}),
  };
  return { ok: true, plan: { year, month, slug, input } };
}

export async function planCreation(req: CreateRequest, now: Date = new Date()): Promise<CreationPlanResult> {
  const originalPostPath = req.translationOf;
  if (originalPostPath === undefined || originalPostPath === "") return planNewPost(req, now);
  return planTranslation(req, originalPostPath, await readTranslationSource(originalPostPath));
}

export function postFileOf(plan: CreationPlan): string {
  return `${plan.year}/${plan.month}/${postFileName(plan.slug, plan.input.lang)}`;
}

function firstNonBlankLine(text: string): string {
  return text.split("\n").find((line) => line.trim() !== "")?.trim() ?? "";
}

export function parseTranslationSource(source: string, file: string): TranslationSource {
  const { body } = splitSource(source, file);
  return { form: readForm(source, file), heading: firstNonBlankLine(body) };
}

async function findSiblingSource(postPath: string): Promise<{ abs: string; name: string } | null> {
  const dir = resolvePostDir(postPath);
  const monthDir = path.dirname(dir.abs);
  let namesInMonth: string[];
  try {
    namesInMonth = await fs.readdir(monthDir);
  } catch {
    return null;
  }
  const name = LANGS.map((lang) => postFileName(dir.slug, lang))
    .find((candidate) => namesInMonth.includes(candidate));
  return name === undefined ? null : { abs: path.join(monthDir, name), name };
}

async function readTranslationSource(postPath: string): Promise<TranslationSource | null> {
  const sibling = await findSiblingSource(postPath);
  if (sibling === null) return null;
  return parseTranslationSource(await fs.readFile(sibling.abs, "utf-8"), sibling.name);
}
