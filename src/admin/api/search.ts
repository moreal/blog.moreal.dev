import { promises as fs } from "node:fs";
import path from "node:path";
import type { APIRoute } from "astro";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { CONTENT_ROOT } from "../lib/paths.ts";
import { scanPosts } from "../lib/scan.ts";
import { findSourceMatches } from "../lib/search.ts";

export const prerender = false;

const MAX_HITS = 60;

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
        const matches = findSourceMatches(text, needle);
        if (matches === null) continue;
        if (hits.length >= MAX_HITS) {
          truncated = true;
          break;
        }
        hits.push({
          file: s.file,
          postPath: s.postPath,
          lang: s.lang,
          title: s.title || s.slug,
          ...matches,
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
