import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { parseFrontMatter } from "../../lib/posts.ts";
import { ADMIN_CONFIG } from "../config.ts";
import { formatMarkdown } from "../lib/format.ts";
import {
  frontMatterEquals,
  serializeFrontMatter,
  splitSource,
} from "../lib/frontmatter.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { PathError, assertNoSymlink, resolvePostFile } from "../lib/paths.ts";
import type { FrontMatterForm } from "../lib/types.ts";

export const prerender = false;

interface SaveRequest {
  file: string;
  frontmatter: FrontMatterForm;
  body: string;
  /** The front matter block as loaded, so an untouched form writes back bytes. */
  fenceRaw: string;
  expectedMtimeMs: number;
  format?: boolean;
}

function normalizeBody(body: string): string {
  return body.replace(/\r\n?/g, "\n").replace(/\n*$/, "\n");
}

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url, { json: true });
  if (bad !== null) return bad;

  let req: SaveRequest;
  try {
    req = (await request.json()) as SaveRequest;
  } catch {
    return fail("bad-request", "body is not JSON");
  }
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

  // Reuse the loaded block when the form still means the same thing, so quoting
  // style and the legacy `draft: "true"` strings survive an untouched save.
  const next = serializeFrontMatter(req.frontmatter);
  const fence =
    typeof req.fenceRaw === "string" && frontMatterEquals(next, req.fenceRaw)
      ? req.fenceRaw
      : next;
  const source = fence + "\n" + normalizeBody(req.body);

  // Refuse to write anything the site could not load; this makes it impossible
  // for the CMS to produce a file that breaks `astro build`.
  try {
    parseFrontMatter(source, ref.rel);
  } catch (e) {
    return fail("invalid", describe(e));
  }

  // Write to a dot-prefixed temp file and rename: walkContent(), the asset
  // route and hongdown's glob all skip dotfiles, so a crashed write cannot
  // corrupt a build.
  const tmp = path.join(
    path.dirname(ref.abs),
    `.${path.basename(ref.abs)}.tmp`,
  );
  try {
    await fs.writeFile(tmp, source, "utf-8");
    await fs.rename(tmp, ref.abs);
  } catch (e) {
    await fs.rm(tmp, { force: true }).catch(() => {});
    return fail("io", describe(e));
  }

  const shouldFormat = req.format !== false && ADMIN_CONFIG.formatOnSave;
  const result = shouldFormat
    ? await formatMarkdown(ref.abs)
    : { formatted: false };

  // hongdown rewraps paragraphs and can move footnote definitions between
  // sections, so the buffer must come back from disk, never from memory.
  const saved = await fs.readFile(ref.abs, "utf-8");
  const { fenceRaw, body } = splitSource(saved, ref.rel);
  return json({
    ok: true,
    file: ref.rel,
    fenceRaw,
    body,
    mtimeMs: (await fs.stat(ref.abs)).mtimeMs,
    formatted: result.formatted,
    ...(result.warning !== undefined
      ? { formatterWarning: result.warning }
      : {}),
    ...(result.notices !== undefined ? { formatterNotices: result.notices } : {}),
  });
};
