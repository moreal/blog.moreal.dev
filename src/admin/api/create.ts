import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { kstIsoOn, nowKstIso, readForm, splitSource } from "../lib/frontmatter.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import {
  CONTENT_ROOT,
  CREATE_SLUG,
  LANGS,
  PathError,
  assertNoSymlink,
  isCalendarDate,
  postFileName,
  resolvePostDir,
  resolvePostFile,
} from "../lib/paths.ts";
import { type PostKind, type ScaffoldInput, scaffold } from "../lib/scaffold.ts";
import type { FrontMatterForm, Lang } from "../lib/types.ts";

export const prerender = false;

interface CreateRequest {
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

/** Read the sibling's front matter and first heading, if a sibling exists. */
async function sibling(postPath: string): Promise<
  { form: FrontMatterForm; heading: string } | null
> {
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
    const heading = body.split("\n").find((l) => l.trim() !== "") ?? "";
    return { form: readForm(source, name), heading: heading.trim() };
  }
  return null;
}

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url, { json: true });
  if (bad !== null) return bad;

  let req: CreateRequest;
  try {
    req = (await request.json()) as CreateRequest;
  } catch {
    return fail("bad-request", "body is not JSON");
  }
  if (!LANGS.includes(req.lang)) {
    return fail("bad-request", `unknown language ${JSON.stringify(req.lang)}`);
  }
  if (!["daily", "reading", "regular"].includes(req.kind)) {
    return fail("bad-request", `unknown kind ${JSON.stringify(req.kind)}`);
  }

  try {
    let year: string;
    let month: string;
    let slug: string;
    let input: ScaffoldInput = { ...req };

    if (req.translationOf !== undefined && req.translationOf !== "") {
      // Deriving the location from the existing post is the whole mechanism:
      // the new file lands in the same month directory and therefore shares
      // YYYY/MM/<slug>/ with no copying at all.
      const dir = resolvePostDir(req.translationOf);
      ({ year, month, slug } = dir);
      const from = await sibling(req.translationOf);
      if (from === null) {
        return fail("not-found", `${req.translationOf} 에 원본이 없습니다.`);
      }
      input = {
        ...input,
        publishedAt: from.form.published,
        ...(from.form.type !== undefined
          ? { kind: from.form.type as PostKind }
          : { kind: "regular" as PostKind }),
        ...(from.form.dark === true ? { dark: true } : {}),
        ...(from.form.book !== undefined ? { book: from.form.book } : {}),
        ...(req.title !== undefined
          ? { title: req.title }
          : from.heading !== ""
          ? { title: from.heading }
          : {}),
      };
    } else {
      const asked = req.date ?? "";
      if (asked !== "" && !isCalendarDate(asked)) {
        return fail("bad-request", "날짜는 실제로 있는 YYYY-MM-DD 여야 합니다.");
      }
      // Resolved here rather than left to scaffold()'s default because the day
      // picks the directory, and for a daily note the file name too.  Only the
      // day moves: a backdated note keeps the current time of day, so its
      // timestamp stays plausible and it still sorts within its own day.
      const published = asked === "" ? nowKstIso() : kstIsoOn(asked);
      input = { ...input, publishedAt: published };

      const day = published.split("T")[0] ?? "";
      if (req.kind === "daily") {
        slug = day;
      } else {
        if (req.slug === undefined || !CREATE_SLUG.test(req.slug)) {
          return fail(
            "bad-name",
            "슬러그는 영소문자·숫자·하이픈만 쓸 수 있습니다.",
          );
        }
        slug = req.slug;
      }
      year = day.slice(0, 4);
      month = day.slice(5, 7);
    }

    const rel = `${year}/${month}/${postFileName(slug, req.lang)}`;
    const ref = resolvePostFile(rel);
    await assertNoSymlink(rel);

    try {
      await fs.access(ref.abs);
      return json({ ok: false, error: "exists", file: rel, message: `${rel} 이미 있습니다.` }, 409);
    } catch {
      // Does not exist; good.
    }

    const built = scaffold(input);
    await fs.mkdir(path.join(CONTENT_ROOT, year, month), { recursive: true });
    // Exclusive create, so a race cannot clobber an existing post.
    await fs.writeFile(ref.abs, built.source, { encoding: "utf-8", flag: "wx" });

    return json({
      ok: true,
      file: rel,
      postPath: ref.postPath,
      lang: ref.lang,
      slug,
    });
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    return fail("io", describe(e));
  }
};
