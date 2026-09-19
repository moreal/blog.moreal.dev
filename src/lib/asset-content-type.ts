const CONTENT_TYPES_BY_EXTENSION: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

const UNKNOWN_CONTENT_TYPE = "application/octet-stream";

export function assetContentType(fileName: string): string {
  const extension = fileName.slice(fileName.lastIndexOf("."));
  return CONTENT_TYPES_BY_EXTENSION[extension.toLowerCase()] ?? UNKNOWN_CONTENT_TYPE;
}
