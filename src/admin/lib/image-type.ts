import { ADMIN_CONFIG, type AdminConfig } from "../config.ts";

export type ImageExtension = { ok: true; ext: string } | { ok: false; message: string };

export function extensionFromMimeType(
  mimeType: string,
  acceptedTypes: AdminConfig["imageTypes"] = ADMIN_CONFIG.imageTypes,
): ImageExtension {
  const ext = Object.hasOwn(acceptedTypes, mimeType) ? acceptedTypes[mimeType] : undefined;
  if (ext === undefined) {
    return { ok: false, message: `${mimeType || "알 수 없는 형식"}은 받지 않습니다.` };
  }
  return { ok: true, ext };
}
