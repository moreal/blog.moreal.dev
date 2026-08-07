import type { APIRoute } from "astro";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import { scanPosts } from "../lib/scan.ts";
import type { PostsResponse } from "../lib/types.ts";

export const prerender = false;

export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;
  try {
    const groups = await scanPosts();
    return json({
      ok: true,
      groups,
      scannedAt: Date.now(),
    } satisfies PostsResponse);
  } catch (e) {
    return fail("io", describe(e));
  }
};
