import type { APIRoute } from "astro";
import { readTextOrNull } from "../lib/files.ts";
import { checkRequest, errorMessageForClient, fail, json } from "../lib/guard.ts";
import { contentPath } from "../lib/paths.ts";
import { scanPosts } from "../lib/scan.ts";
import { searchSources } from "../lib/search.ts";
import type { SearchResponse } from "../lib/types.ts";
import { isSearchableQuery } from "../shared/search-query.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;

  const query = (url.searchParams.get("q") ?? "").trim();
  if (!isSearchableQuery(query)) {
    return json({ ok: true, query, hits: [], truncated: false } satisfies SearchResponse);
  }

  try {
    const groups = await scanPosts();
    const found = await searchSources(groups, query.toLowerCase(), (file) =>
      readTextOrNull(contentPath(file)),
    );
    return json({ ok: true, query, ...found } satisfies SearchResponse);
  } catch (e) {
    return fail("io", errorMessageForClient(e));
  }
};
