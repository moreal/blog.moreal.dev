import type { PostKind } from "../lib/types.ts";

export const POST_KIND_LABELS: Record<PostKind, string> = {
  regular: "일반 글",
  daily: "일상",
  reading: "독후감",
};
