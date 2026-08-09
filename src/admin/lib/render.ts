import { createHash } from "node:crypto";
import { renderViews, type PostView } from "../../lib/posts.ts";

/**
 * Preview for an unsaved buffer, through exactly the pipeline the published
 * pages use -- including its quirks, so what the preview shows is what will
 * ship.  posts.ts's own cache is keyed by file mtime and so cannot serve a
 * buffer; this one is keyed by content instead.
 *
 * Worth caching because every ko-Kore render reloads seonbi's kr-stdict
 * dictionary (~130ms per call, and a ko-Kore source needs two calls).
 */
const MAX = 32;
const cache = new Map<string, PostView[]>();

export function renderBuffer(source: string, lang: string): PostView[] {
  const key =
    createHash("sha256").update(source).digest("hex").slice(0, 32) + ":" + lang;
  const hit = cache.get(key);
  if (hit !== undefined) {
    // Refresh recency.
    cache.delete(key);
    cache.set(key, hit);
    return hit;
  }
  const views = renderViews(source, lang);
  cache.set(key, views);
  if (cache.size > MAX) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }
  return views;
}
