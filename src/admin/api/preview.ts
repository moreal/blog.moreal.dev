import type { APIRoute } from "astro";
import { serializeFrontMatter } from "../lib/frontmatter.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { LANGS, PathError, resolvePostFile } from "../lib/paths.ts";
import { renderPreviewDocument } from "../lib/preview-doc.ts";
import type { Lang, PreviewRequest, PreviewResponse } from "../lib/types.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url, { json: true });
  if (bad !== null) return bad;

  let body: PreviewRequest;
  try {
    body = (await request.json()) as PreviewRequest;
  } catch {
    return fail("bad-request", "body is not JSON");
  }
  if (
    typeof body.file !== "string" ||
    typeof body.body !== "string" ||
    typeof body.lang !== "string"
  ) {
    return fail("bad-request", "expected { file, frontmatter, body, lang }");
  }
  if (!LANGS.includes(body.lang as Lang)) {
    return fail("bad-request", `unknown language ${JSON.stringify(body.lang)}`);
  }

  let ref;
  try {
    ref = resolvePostFile(body.file);
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    throw e;
  }
  if (ref.lang !== body.lang) {
    return fail("bad-request", "lang does not match the file name");
  }

  const started = performance.now();
  try {
    // Composed the same way save.ts will write it, so a preview that renders
    // is a file that will build.
    const source = serializeFrontMatter(body.frontmatter) + "\n" + body.body;
    const views = await renderPreviewDocument(ref, source);
    return json({
      ok: true,
      views,
      ms: Math.round(performance.now() - started),
    } satisfies PreviewResponse);
  } catch (e) {
    return fail("invalid", describe(e));
  }
};
