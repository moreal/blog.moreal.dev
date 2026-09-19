import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import {
  type CreateRequest,
  planNewPost,
  planTranslation,
  readTranslationSource,
} from "../lib/create-plan.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import {
  CONTENT_ROOT,
  LANGS,
  PathError,
  assertNoSymlink,
  postFileName,
  resolvePostFile,
} from "../lib/paths.ts";
import { scaffold } from "../lib/scaffold.ts";

export const prerender = false;

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
    const translationPath = req.translationOf;
    const result = translationPath !== undefined && translationPath !== ""
      ? planTranslation(req, translationPath, await readTranslationSource(translationPath))
      : planNewPost(req);
    if (!result.ok) return fail(result.error, result.message);
    const { year, month, slug, input } = result.plan;

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
