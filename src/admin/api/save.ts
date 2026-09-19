import { promises as fs } from "node:fs";
import type { APIRoute } from "astro";
import { parseFrontMatter } from "../../lib/posts.ts";
import { ADMIN_CONFIG } from "../config.ts";
import {
  composeSavedSource,
  formatAndReadSavedPost,
  replacePostFileAtomically,
} from "../lib/save.ts";
import { checkRequest, errorMessageForClient, fail, json, readJsonBody } from "../lib/guard.ts";
import { PathError, assertNoSymlink, resolvePostFile } from "../lib/paths.ts";
import type { FrontMatterForm } from "../lib/types.ts";

export const prerender = false;

interface SaveRequest {
  file: string;
  frontmatter: FrontMatterForm;
  body: string;
  fenceRaw: string;
  expectedMtimeMs: number;
  format?: boolean;
}

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url, { contentType: "application/json" });
  if (bad !== null) return bad;

  const req = await readJsonBody<SaveRequest>(request);
  if (req instanceof Response) return req;
  if (typeof req.file !== "string" || typeof req.body !== "string") {
    return fail("bad-request", "expected { file, frontmatter, body, ... }");
  }

  let ref;
  try {
    ref = resolvePostFile(req.file);
    await assertNoSymlink(ref.rel);
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    throw e;
  }

  let mtimeMs: number;
  try {
    mtimeMs = (await fs.stat(ref.abs)).mtimeMs;
  } catch {
    return fail("not-found", `${ref.rel} does not exist`);
  }
  if (
    typeof req.expectedMtimeMs === "number" &&
    Math.abs(mtimeMs - req.expectedMtimeMs) > 1
  ) {
    return json(
      {
        ok: false,
        error: "stale",
        message: "파일이 편집기 밖에서 바뀌었습니다.",
        currentMtimeMs: mtimeMs,
      },
      409,
    );
  }

  const source = composeSavedSource(req);
  try {
    parseFrontMatter(source, ref.rel);
  } catch (e) {
    return fail("invalid", errorMessageForClient(e));
  }

  try {
    await replacePostFileAtomically(ref.abs, source);
  } catch (e) {
    return fail("io", errorMessageForClient(e));
  }

  const shouldFormat = req.format !== false && ADMIN_CONFIG.formatOnSave;
  const saved = await formatAndReadSavedPost(ref, shouldFormat);
  return json({ ok: true, file: ref.rel, ...saved });
};
