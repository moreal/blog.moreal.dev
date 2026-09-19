import type { SaveResponse } from "../lib/types.ts";

export type SavedPost = Extract<SaveResponse, { ok: true }>;

export function savedStatus(saved: SavedPost): string {
  return saved.formatted ? "저장됨 · hongdown 적용" : "저장됨";
}

export function formatterWarningOf(saved: SavedPost): string | undefined {
  if (saved.formatterWarning !== undefined) return saved.formatterWarning;
  if (saved.formatterNotices !== undefined) return `hongdown: ${saved.formatterNotices}`;
  return undefined;
}
