import { ADMIN_CONFIG, type AdminConfig, type ImageNameContext } from "../config.ts";
import { kstClockTime, kstDate } from "../shared/dates.ts";
import type { PostFileRef } from "./paths.ts";

type ImageNamingConfig = Pick<AdminConfig, "imageNamePattern" | "suggestImageName">;
type PostOfImage = Pick<PostFileRef, "year" | "month" | "slug" | "lang" | "postPath">;
type IncomingImage = Pick<ImageNameContext, "originalName" | "ext" | "existing">;

const NAMES_THAT_SAY_NOTHING = new Set([
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
const DIGITS_AND_SEPARATORS_ONLY = /^[\d\s.:_-]+$/;
const CAMERA_OR_SCREENSHOT_PREFIX = /^(img|dsc|pxl|screenshot|스크린샷)[\s_-]/i;
const MAX_SLUG_LENGTH = 60;
const CANDIDATE_LIMIT = 1000;

function slugifyName(stem: string): string {
  return stem
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH);
}

function withoutExtension(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "");
}

function stemOf(fileName: string): string {
  return withoutExtension(fileName).trim();
}

function slugOfOriginalName(originalName: string | null): string | null {
  if (originalName === null) return null;
  const stem = stemOf(originalName);
  if (saysNothingAtAll(stem)) return null;
  const slug = slugifyName(stem);
  return slug === "" ? null : slug;
}

function slugOfDescriptiveName(originalName: string | null): string | null {
  if (originalName === null) return null;
  return isGenericName(stemOf(originalName)) ? null : slugOfOriginalName(originalName);
}

function saysNothingAtAll(stem: string): boolean {
  return NAMES_THAT_SAY_NOTHING.has(stem.toLowerCase());
}

function isGenericName(stem: string): boolean {
  return (
    saysNothingAtAll(stem) ||
    DIGITS_AND_SEPARATORS_ONLY.test(stem) ||
    CAMERA_OR_SCREENSHOT_PREFIX.test(stem)
  );
}

function expandPattern(
  pattern: string,
  ctx: ImageNameContext,
  index: number,
  now: Date,
): string {
  return pattern.replace(/\{(\w+)\}/g, (placeholder, token: string) => {
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
        return hoursMinutesSeconds(now);
      case "original":
        return slugOfOriginalName(ctx.originalName) ?? "image";
      default:
        return placeholder;
    }
  });
}

function hoursMinutesSeconds(time: Date): string {
  return kstClockTime(time).replaceAll(":", "");
}

export function imageNameContext(
  post: PostOfImage,
  image: IncomingImage,
  now: Date = new Date(),
): ImageNameContext {
  return {
    year: post.year,
    month: post.month,
    day: kstDayOfMonth(now),
    slug: post.slug,
    lang: post.lang,
    postPath: post.postPath,
    originalName: image.originalName,
    ext: image.ext,
    existing: image.existing,
  };
}

function kstDayOfMonth(time: Date): string {
  return kstDate(time).slice(8, 10);
}

export function suggestImageName(
  ctx: ImageNameContext,
  config: ImageNamingConfig = ADMIN_CONFIG,
  now: Date = new Date(),
): string {
  const override = config.suggestImageName?.(ctx);
  if (override !== undefined && override !== "") return slugifyName(override);

  const taken = new Set(ctx.existing.map((file) => withoutExtension(file).toLowerCase()));
  const descriptive = slugOfDescriptiveName(ctx.originalName);
  if (descriptive === null) return firstFreePatternName(config.imageNamePattern, ctx, taken, now);
  return taken.has(descriptive) ? firstFreeNumberedName(descriptive, taken) : descriptive;
}

function firstFreePatternName(
  pattern: string,
  ctx: ImageNameContext,
  taken: Set<string>,
  now: Date,
): string {
  for (let index = 1; index <= CANDIDATE_LIMIT; index++) {
    const candidate = slugifyName(expandPattern(pattern, ctx, index, now));
    if (!taken.has(candidate)) return candidate;
  }
  const lastResort = slugifyName(expandPattern(pattern, ctx, CANDIDATE_LIMIT + 1, now));
  return taken.has(lastResort) ? firstFreeNumberedName(lastResort, taken) : lastResort;
}

function firstFreeNumberedName(base: string, taken: Set<string>): string {
  for (let suffix = 2; suffix < CANDIDATE_LIMIT; suffix++) {
    const candidate = `${base}-${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
  return base;
}
