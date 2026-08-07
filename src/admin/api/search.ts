import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { CONTENT_ROOT } from "../lib/paths.ts";
import { scanPosts } from "../lib/scan.ts";

export const prerender = false;

const MAX_HITS = 60;
const CONTEXT = 48;

/**
 * Full-text search over post bodies.  The list page filters titles and paths
 * client-side; this exists for the rest -- finding the post that mentioned a
 * command, a name, a Hanja spelling.
 *
 * Reads every file on each query.  At this corpus size that is a few
 * milliseconds, and an index would need invalidating on every save.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;

  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return json({ ok: true, query: q, hits: [], truncated: false });
  }

  try {
    const needle = q.toLowerCase();
    const groups = await scanPosts();
    const hits: {
      file: string;
      postPath: string;
      lang: string;
      title: string;
      line: number;
      excerpt: string;
      count: number;
    }[] = [];
    let truncated = false;

    for (const g of groups) {
      for (const s of g.sources) {
        const abs = path.join(CONTENT_ROOT, ...s.file.split("/"));
        let text: string;
        try {
          text = await fs.readFile(abs, "utf-8");
        } catch {
          continue;
        }
        const lines = text.split("\n");
        let count = 0;
        let first: { line: number; excerpt: string } | null = null;
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!;
          const at = line.toLowerCase().indexOf(needle);
          if (at === -1) continue;
          count++;
          if (first === null) {
            const start = Math.max(0, at - CONTEXT);
            first = {
              line: i + 1,
              excerpt:
                (start > 0 ? "…" : "") +
                line.slice(start, at + needle.length + CONTEXT).trim() +
                (at + needle.length + CONTEXT < line.length ? "…" : ""),
            };
          }
        }
        if (first === null) continue;
        if (hits.length >= MAX_HITS) {
          truncated = true;
          break;
        }
        hits.push({
          file: s.file,
          postPath: s.postPath,
          lang: s.lang,
          title: s.title || s.slug,
          line: first.line,
          excerpt: first.excerpt,
          count,
        });
      }
      if (truncated) break;
    }

    hits.sort((a, b) => b.count - a.count);
    return json({ ok: true, query: q, hits, truncated });
  } catch (e) {
    return fail("io", describe(e));
  }
};
