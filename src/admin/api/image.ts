import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { ADMIN_CONFIG } from "../config.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import {
  CONTENT_ROOT,
  PathError,
  assertNoSymlink,
  resolvePostFile,
} from "../lib/paths.ts";
import { listAssets } from "../lib/scan.ts";

export const prerender = false;

const BASE_NAME = /^[a-z0-9][a-z0-9._-]*$/;

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;
  const ct = request.headers.get("content-type") ?? "";
  if (!ct.includes("multipart/form-data")) {
    return fail("bad-request", "expected multipart/form-data");
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return fail("bad-request", describe(e));
  }

  const blob = form.get("file");
  const mdFile = form.get("mdFile");
  const name = form.get("name");
  const overwrite = form.get("overwrite") === "true";
  if (!(blob instanceof File) || typeof mdFile !== "string" || typeof name !== "string") {
    return fail("bad-request", "expected file, mdFile and name");
  }

  // The extension comes from the MIME type, never from the client's file name.
  const ext = ADMIN_CONFIG.imageTypes[blob.type];
  if (ext === undefined) {
    return fail("unsupported-type", `${blob.type || "알 수 없는 형식"}은 받지 않습니다.`);
  }
  if (blob.size > ADMIN_CONFIG.maxImageBytes) {
    return fail(
      "too-large",
      `${Math.round(blob.size / 1024)}KB — 상한은 ${Math.round(ADMIN_CONFIG.maxImageBytes / 1024)}KB입니다.`,
    );
  }
  const base = name.trim().toLowerCase();
  if (!BASE_NAME.test(base) || base.includes("..")) {
    return fail("bad-name", "이름은 영소문자·숫자·하이픈·밑줄만 쓸 수 있습니다.");
  }

  let ref;
  try {
    ref = resolvePostFile(mdFile);
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    throw e;
  }

  const fileName = base.endsWith(ext) ? base : base + ext;
  const rel = `${ref.postPath}/${fileName}`;
  const abs = path.join(CONTENT_ROOT, ...rel.split("/"));

  try {
    await assertNoSymlink(rel);
    // The bundle is named after the bare slug and shared by every language
    // variant of the post, so it may well already exist.
    await fs.mkdir(path.dirname(abs), { recursive: true });
    if (!overwrite) {
      try {
        await fs.access(abs);
        return json(
          {
            ok: false,
            error: "exists",
            message: `${fileName} 이(가) 이미 있습니다.`,
            existing: (await listAssets(ref.postPath)).map((a) => a.file),
          },
          409,
        );
      } catch {
        // Free; carry on.
      }
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    await fs.writeFile(abs, bytes, overwrite ? {} : { flag: "wx" });

    return json({
      ok: true,
      assetPath: rel,
      // URL-relative, matching how every existing post references its images:
      // correct next to the published index.html, not on disk.
      markdown: `![](./${fileName})`,
      previewUrl: `/${rel}`,
      bytes: bytes.length,
    });
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    return fail("io", describe(e));
  }
};
