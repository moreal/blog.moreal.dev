import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { ADMIN_CONFIG } from "../config.ts";
import { fileExists, writeWithoutClobbering } from "../lib/files.ts";
import {
  badRequestOnPathError,
  checkRequest,
  errorMessageForClient,
  fail,
  failForThrown,
  json,
} from "../lib/guard.ts";
import { extensionFromMimeType } from "../lib/image-type.ts";
import { imageSizeProblem, uploadedImageFileName } from "../lib/image-upload.ts";
import { assertNoSymlink, contentPath, resolvePostFile } from "../lib/paths.ts";
import { listAssetNames } from "../lib/scan.ts";
import { imageMarkdown } from "../shared/image-names.ts";

export const prerender = false;

export const POST: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url, { contentType: "multipart/form-data" });
  if (bad !== null) return bad;

  let form: FormData;
  try {
    form = await request.formData();
  } catch (e) {
    return fail("bad-request", errorMessageForClient(e));
  }

  const blob = form.get("file");
  const mdFile = form.get("mdFile");
  const name = form.get("name");
  const overwrite = form.get("overwrite") === "true";
  if (!(blob instanceof File) || typeof mdFile !== "string" || typeof name !== "string") {
    return fail("bad-request", "expected file, mdFile and name");
  }

  const imageType = extensionFromMimeType(blob.type);
  if (!imageType.ok) return fail("unsupported-type", imageType.message);
  const { ext } = imageType;
  const sizeProblem = imageSizeProblem(blob.size, ADMIN_CONFIG.maxImageBytes);
  if (sizeProblem !== null) return fail("too-large", sizeProblem);
  const fileName = uploadedImageFileName(name, ext);
  if (fileName === null) {
    return fail("bad-name", "이름은 영소문자·숫자·하이픈·밑줄만 쓸 수 있습니다.");
  }

  const ref = await badRequestOnPathError(() => resolvePostFile(mdFile));
  if (ref instanceof Response) return ref;

  const rel = `${ref.postPath}/${fileName}`;
  const abs = contentPath(rel);

  try {
    await assertNoSymlink(rel);
    // The bundle is named after the bare slug and shared by every language
    // variant of the post, so it may well already exist.
    await fs.mkdir(path.dirname(abs), { recursive: true });
    if (!overwrite && (await fileExists(abs))) {
      return json(
        {
          ok: false,
          error: "exists",
          message: `${fileName} 이(가) 이미 있습니다.`,
          existing: await listAssetNames(ref.postPath),
        },
        409,
      );
    }
    const bytes = Buffer.from(await blob.arrayBuffer());
    await (overwrite ? fs.writeFile(abs, bytes) : writeWithoutClobbering(abs, bytes));

    return json({
      ok: true,
      assetPath: rel,
      markdown: imageMarkdown(fileName),
      previewUrl: `/${rel}`,
      bytes: bytes.length,
    });
  } catch (e) {
    return failForThrown(e);
  }
};
