import { promises as fs } from "node:fs";
import path from "node:path";
import { readForm, splitSource } from "./frontmatter.ts";
import { kstIsoOn, nowKstIso } from "../shared/dates.ts";
import { CREATE_SLUG, LANGS, isCalendarDate, postFileName, resolvePostDir } from "./paths.ts";
import type { PostKind, ScaffoldInput } from "./scaffold.ts";
import type { FrontMatterForm, Lang } from "./types.ts";

export interface CreateRequest {
  kind: PostKind;
  lang: Lang;
  slug?: string;
  title?: string;
  /**
   * Day the post is published on, "YYYY-MM-DD"; defaults to today in KST.
   * For a daily note it therefore also decides the file name and the title.
   */
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

export type CreationPlanResult =
  | { ok: true; plan: CreationPlan }
  | { ok: false; error: "bad-request" | "bad-name" | "not-found"; message: string };

/** Select the publication day before deriving the directory and daily slug. */
export function planNewPost(req: CreateRequest): CreationPlanResult {
  const requestedDate = req.date ?? "";
  if (requestedDate !== "" && !isCalendarDate(requestedDate)) {
    return {
      ok: false,
      error: "bad-request",
      message: "날짜는 실제로 있는 YYYY-MM-DD 여야 합니다.",
    };
  }
  // Backdating changes the day but retains the current KST time of day.
  const published = requestedDate === "" ? nowKstIso() : kstIsoOn(requestedDate);
  const day = published.split("T")[0] ?? "";
  let slug: string;
  if (req.kind === "daily") {
    slug = day;
  } else {
    if (req.slug === undefined || !CREATE_SLUG.test(req.slug)) {
      return {
        ok: false,
        error: "bad-name",
        message: "슬러그는 영소문자·숫자·하이픈만 쓸 수 있습니다.",
      };
    }
    slug = req.slug;
  }
  return {
    ok: true,
    plan: {
      year: day.slice(0, 4),
      month: day.slice(5, 7),
      slug,
      input: { ...req, publishedAt: published },
    },
  };
}

/** Translations share the original location and inherit its publication metadata. */
export function planTranslation(
  req: CreateRequest,
  postPath: string,
  original: TranslationSource | null,
): CreationPlanResult {
  const { year, month, slug } = resolvePostDir(postPath);
  if (original === null) {
    return { ok: false, error: "not-found", message: `${postPath} 에 원본이 없습니다.` };
  }
  const input: ScaffoldInput = {
    ...req,
    publishedAt: original.form.published,
    kind: original.form.type !== undefined ? original.form.type as PostKind : "regular",
    ...(original.form.dark === true ? { dark: true } : {}),
    ...(original.form.book !== undefined ? { book: original.form.book } : {}),
    ...(req.title !== undefined
      ? { title: req.title }
      : original.heading !== ""
      ? { title: original.heading }
      : {}),
  };
  return { ok: true, plan: { year, month, slug, input } };
}

/** Read the sibling's front matter and first heading, if a sibling exists. */
export async function readTranslationSource(postPath: string): Promise<TranslationSource | null> {
  const dir = resolvePostDir(postPath);
  const monthDir = path.dirname(dir.abs);
  let names: string[];
  try {
    names = await fs.readdir(monthDir);
  } catch {
    return null;
  }
  for (const lang of LANGS) {
    const name = postFileName(dir.slug, lang);
    if (!names.includes(name)) continue;
    const source = await fs.readFile(path.join(monthDir, name), "utf-8");
    const { body } = splitSource(source, name);
    const heading = body.split("\n").find((line) => line.trim() !== "") ?? "";
    return { form: readForm(source, name), heading: heading.trim() };
  }
  return null;
}
