import type { APIRoute } from "astro";
import { ADMIN_CONFIG } from "../config.ts";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { suggestImageName } from "../lib/image-name.ts";
import { PathError, resolvePostFile } from "../lib/paths.ts";
import { listAssets } from "../lib/scan.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;

  const mdFile = url.searchParams.get("mdFile");
  const mime = url.searchParams.get("mime") ?? "";
  const originalName = url.searchParams.get("originalName");
  if (mdFile === null) return fail("bad-request", "missing ?mdFile=");

  const ext = ADMIN_CONFIG.imageTypes[mime];
  if (ext === undefined) {
    return fail("unsupported-type", `${mime || "알 수 없는 형식"}은 받지 않습니다.`);
  }

  try {
    const ref = resolvePostFile(mdFile);
    const existing = (await listAssets(ref.postPath)).map((a) => a.file);
    const suggestion = suggestImageName({
      year: ref.year,
      month: ref.month,
      day: new Date().toISOString().slice(8, 10),
      slug: ref.slug,
      lang: ref.lang,
      postPath: ref.postPath,
      originalName,
      ext,
      existing,
    });
    return json({ ok: true, suggestion, ext, existing, dir: ref.postPath });
  } catch (e) {
    if (e instanceof PathError) return fail("bad-request", e.message);
    return fail("io", describe(e));
  }
};
