import { isImageBaseName, normalizedImageBaseName } from "../shared/image-names.ts";

function kilobytes(bytes: number): number {
  return Math.round(bytes / 1024);
}

export function imageSizeProblem(bytes: number, maxBytes: number): string | null {
  if (bytes <= maxBytes) return null;
  return `${kilobytes(bytes)}KB — 상한은 ${kilobytes(maxBytes)}KB입니다.`;
}

export function uploadedImageFileName(requestedName: string, ext: string): string | null {
  const base = normalizedImageBaseName(requestedName);
  if (!isImageBaseName(base) || base.includes("..")) return null;
  return base.endsWith(ext) ? base : base + ext;
}
