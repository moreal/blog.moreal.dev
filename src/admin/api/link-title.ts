import type { APIRoute } from "astro";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import {
  TitleRuleError,
  applyTitleRules,
  loadTitleRules,
} from "../lib/title-rules.ts";
import { decodeHtml, extractTitle, readResponsePrefix } from "../lib/html-title.ts";
import type { LinkTitleResponse } from "../lib/types.ts";

export const prerender = false;

const TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;

/**
 * Fetch a page and report its title, for the "제목 가져와 별칭으로" paste
 * action.  The fetch happens server-side because the browser cannot: a
 * cross-origin GET from the admin page would be stopped by CORS.
 *
 * Only ever called with a URL the author just pasted, so there is no SSRF
 * surface to speak of -- the same person could open the URL in a tab.
 */
export const GET: APIRoute = async ({ request, url }) => {
  const bad = checkRequest(request, url);
  if (bad !== null) return bad;

  let target: URL;
  try {
    target = new URL((url.searchParams.get("url") ?? "").trim());
  } catch {
    return fail("bad-request", "URL이 올바르지 않습니다");
  }
  if (target.protocol !== "http:" && target.protocol !== "https:") {
    return fail("bad-request", "http(s) URL만 지원합니다");
  }

  // Before the fetch: a broken rules file should fail fast and say so, not
  // surface as a mysterious io error after seconds of network wait.
  let rules;
  try {
    rules = await loadTitleRules();
  } catch (e) {
    if (e instanceof TitleRuleError) return fail("invalid", e.message);
    throw e;
  }

  try {
    const res = await fetch(target, {
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Some sites turn away anything that does not look like a browser.
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
        "accept-language": "ko,en;q=0.8",
      },
    });
    if (!res.ok) {
      void res.body?.cancel().catch(() => {});
      return fail("not-found", `HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!/html|xhtml/i.test(contentType)) {
      void res.body?.cancel().catch(() => {});
      return json({ ok: true, url: res.url, title: null } satisfies LinkTitleResponse);
    }
    const bytes = await readResponsePrefix(res.body, MAX_BYTES);
    const html = decodeHtml(bytes, contentType);
    const raw = extractTitle(html);
    // Rules match the post-redirect host: that is the site actually serving
    // the page, and what its title convention belongs to.
    const title =
      raw === null ? null : applyTitleRules(raw, new URL(res.url).hostname, rules);
    return json({ ok: true, url: res.url, title } satisfies LinkTitleResponse);
  } catch (e) {
    if ((e as { name?: string } | null)?.name === "TimeoutError") {
      return fail("io", `응답이 ${TIMEOUT_MS / 1000}초 안에 오지 않았습니다`);
    }
    const cause =
      e instanceof Error && e.cause instanceof Error ? `: ${e.cause.message}` : "";
    return fail("io", describe(e) + cause);
  }
};
