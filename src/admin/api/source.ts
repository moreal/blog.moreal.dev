import { promises as fs } from "node:fs";
import type { APIRoute } from "astro";
import { readForm, splitSource } from "../lib/frontmatter.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { PathError, resolvePostFile } from "../lib/paths.ts";
import { listAssets } from "../lib/scan.ts";
import type { SourceResponse } from "../lib/types.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;

  const file = url.searchParams.get("file");
  if (file === null) return fail("bad-request", "missing ?file=");

  let ref;
  try {
    ref = resolvePostFile(file);
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    throw e;
  }

  let source: string;
  let mtimeMs: number;
  try {
    source = await fs.readFile(ref.abs, "utf-8");
    mtimeMs = (await fs.stat(ref.abs)).mtimeMs;
  } catch {
    return fail("not-found", `${ref.rel} does not exist`);
  }

  try {
    const { fenceRaw, body } = splitSource(source, ref.rel);
    return json({
      ok: true,
      file: ref.rel,
      postPath: ref.postPath,
      year: ref.year,
      month: ref.month,
      slug: ref.slug,
      lang: ref.lang,
      fenceRaw,
      body,
      frontmatter: readForm(source, ref.rel),
      mtimeMs,
      assets: await listAssets(ref.postPath),
    } satisfies SourceResponse);
  } catch (e) {
    return fail("invalid", describe(e));
  }
};
