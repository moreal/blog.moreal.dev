import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import {
  type CreateRequest,
  planCreation,
  postFileOf,
  unknownLangOrKindMessage,
} from "../lib/create-plan.ts";
import { fileExists, writeWithoutClobbering } from "../lib/files.ts";
import { checkRequest, fail, failForThrown, json, readJsonBody } from "../lib/guard.ts";
import { assertNoSymlink, resolvePostFile } from "../lib/paths.ts";
import { scaffoldSource } from "../lib/scaffold.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url, { contentType: "application/json" });
  if (bad !== null) return bad;

  const req = await readJsonBody<CreateRequest>(request);
  if (req instanceof Response) return req;
  const unknownChoice = unknownLangOrKindMessage(req);
  if (unknownChoice !== null) return fail("bad-request", unknownChoice);

  try {
    const result = await planCreation(req);
    if (!result.ok) return fail(result.error, result.message);
    const { slug, input } = result.plan;

    const file = postFileOf(result.plan);
    const ref = resolvePostFile(file);
    await assertNoSymlink(file);
    if (await fileExists(ref.abs)) {
      return json({ ok: false, error: "exists", file, message: `${file} 이미 있습니다.` }, 409);
    }

    await fs.mkdir(path.dirname(ref.abs), { recursive: true });
    await writeWithoutClobbering(ref.abs, scaffoldSource(input));

    return json({
      ok: true,
      file,
      postPath: ref.postPath,
      lang: ref.lang,
      slug,
    });
  } catch (e) {
    return failForThrown(e);
  }
};
