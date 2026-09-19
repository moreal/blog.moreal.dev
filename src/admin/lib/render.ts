import { createHash } from "node:crypto";
import { renderViews, type PostView } from "../../lib/posts.ts";

export const RECENT_BUFFERS_KEPT = 32;

// Each seonbi call reloads the kr-stdict dictionary (~130ms) and a ko-Kore
// buffer needs two, so the preview keeps what it rendered recently.
const renderedViewsByContent = recentlyUsedCache<PostView[]>(RECENT_BUFFERS_KEPT);

export function renderBuffer(source: string, lang: string): PostView[] {
  const key = contentKey(source, lang);
  const kept = renderedViewsByContent.get(key);
  if (kept !== undefined) return kept;

  const views = renderViews(source, lang);
  renderedViewsByContent.set(key, views);
  return views;
}

function contentKey(source: string, lang: string): string {
  const sourceHash = createHash("sha256").update(source).digest("hex").slice(0, 32);
  return `${sourceHash}:${lang}`;
}

export interface RecentlyUsedCache<Value> {
  get(key: string): Value | undefined;
  set(key: string, value: Value): void;
}

export function recentlyUsedCache<Value>(capacity: number): RecentlyUsedCache<Value> {
  const valuesFromLeastRecent = new Map<string, Value>();
  return {
    get(key) {
      const value = valuesFromLeastRecent.get(key);
      if (value !== undefined) moveToMostRecent(valuesFromLeastRecent, key, value);
      return value;
    },
    set(key, value) {
      moveToMostRecent(valuesFromLeastRecent, key, value);
      if (valuesFromLeastRecent.size > capacity) dropLeastRecent(valuesFromLeastRecent);
    },
  };
}

function moveToMostRecent<Value>(
  valuesFromLeastRecent: Map<string, Value>,
  key: string,
  value: Value,
): void {
  valuesFromLeastRecent.delete(key);
  valuesFromLeastRecent.set(key, value);
}

function dropLeastRecent<Value>(valuesFromLeastRecent: Map<string, Value>): void {
  const leastRecent = valuesFromLeastRecent.keys().next();
  if (!leastRecent.done) valuesFromLeastRecent.delete(leastRecent.value);
}
