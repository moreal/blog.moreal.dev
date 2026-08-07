import { ADMIN_CONFIG, type ImageNameContext } from "../config.ts";

/**
 * Names that carry no information -- a macOS screenshot pasted from the
 * clipboard arrives as "image.png", so falling back to the pattern is right.
 * A file dragged in as "container-insight-network-rx.png" keeps its name, which
 * is the convention every existing image in this repo follows.
 */
const MEANINGLESS = new Set([
  "image",
  "images",
  "screenshot",
  "screen shot",
  "스크린샷",
  "화면",
  "pasted",
  "paste",
  "clipboard",
  "untitled",
  "unknown",
  "download",
  "photo",
]);

export function slugifyName(stem: string): string {
  return stem
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function meaningful(originalName: string | null): string | null {
  if (originalName === null || originalName === "") return null;
  const stem = originalName.replace(/\.[^.]+$/, "").trim();
  const lower = stem.toLowerCase();
  if (MEANINGLESS.has(lower)) return null;
  // "Screenshot 2026-08-07 at 23.05.11", "IMG_1234", "2026-08-07" and friends.
  if (/^[\d\s.:_-]+$/.test(stem)) return null;
  if (/^(img|dsc|pxl|screenshot|스크린샷)[\s_-]/i.test(stem)) return null;
  const slug = slugifyName(stem);
  return slug === "" ? null : slug;
}

function expand(pattern: string, ctx: ImageNameContext, index: number): string {
  const hh = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return pattern.replace(/\{(\w+)\}/g, (all, token: string) => {
    switch (token) {
      case "slug":
        return ctx.slug;
      case "year":
        return ctx.year;
      case "month":
        return ctx.month;
      case "day":
        return ctx.day;
      case "lang":
        return ctx.lang;
      case "index":
        return String(index);
      case "hhmmss":
        return `${pad(hh.getHours())}${pad(hh.getMinutes())}${pad(hh.getSeconds())}`;
      case "original":
        return meaningful(ctx.originalName) ?? "image";
      default:
        return all;
    }
  });
}

/**
 * Suggest a base name (no extension).  Computed on the server because the
 * `{index}` token depends on what is already sitting in the asset directory.
 */
export function suggestImageName(ctx: ImageNameContext): string {
  const override = ADMIN_CONFIG.suggestImageName?.(ctx);
  if (override !== undefined && override !== "") return slugifyName(override);

  const taken = new Set(
    ctx.existing.map((f) => f.replace(/\.[^.]+$/, "").toLowerCase()),
  );

  const kept = meaningful(ctx.originalName);
  if (kept !== null && !taken.has(kept)) return kept;

  let base = kept;
  if (base === null) {
    let index = 1;
    for (; index < 1000; index++) {
      const candidate = slugifyName(expand(ADMIN_CONFIG.imageNamePattern, ctx, index));
      if (!taken.has(candidate)) return candidate;
    }
    base = slugifyName(expand(ADMIN_CONFIG.imageNamePattern, ctx, index));
  }
  for (let n = 2; n < 1000; n++) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}
