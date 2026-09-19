import type { APIRoute } from "astro";
import { checkRequest, fail, failForThrown, json } from "../lib/guard.ts";
import { imageNameContext, suggestImageName } from "../lib/image-name.ts";
import { extensionFromMimeType } from "../lib/image-type.ts";
import { resolvePostFile } from "../lib/paths.ts";
import { listAssetNames } from "../lib/scan.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;

  const mdFile = url.searchParams.get("mdFile");
  const mime = url.searchParams.get("mime") ?? "";
  const originalName = url.searchParams.get("originalName");
  if (mdFile === null) return fail("bad-request", "missing ?mdFile=");

  const imageType = extensionFromMimeType(mime);
  if (!imageType.ok) return fail("unsupported-type", imageType.message);
  const { ext } = imageType;

  try {
    const ref = resolvePostFile(mdFile);
    const existing = await listAssetNames(ref.postPath);
    const suggestion = suggestImageName(imageNameContext(ref, { originalName, ext, existing }));
    return json({ ok: true, suggestion, ext, existing, dir: ref.postPath });
  } catch (e) {
    return failForThrown(e);
  }
};
