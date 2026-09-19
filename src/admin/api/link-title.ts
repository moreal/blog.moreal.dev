import type { APIRoute } from "astro";
import { checkRequest, fail, json } from "../lib/guard.ts";
import { extractTitle } from "../lib/html-title.ts";
import {
  discardBody,
  fetchFailureMessage,
  fetchPage,
  isHtmlContentType,
  parsePageUrl,
  readHtml,
} from "../lib/link-page.ts";
import {
  TitleRuleError,
  applyTitleRules,
  loadTitleRules,
} from "../lib/title-rules.ts";
import type { LinkTitleResponse } from "../lib/types.ts";

export const prerender = false;

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

  const page = parsePageUrl(url.searchParams.get("url") ?? "");
  if (!page.ok) return fail("bad-request", page.message);

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
    const res = await fetchPage(page.url);
    if (!res.ok) {
      discardBody(res);
      return fail("not-found", `HTTP ${res.status}`);
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!isHtmlContentType(contentType)) {
      discardBody(res);
      return json({ ok: true, url: res.url, title: null } satisfies LinkTitleResponse);
    }
    const raw = extractTitle(await readHtml(res, contentType));
    const hostServingThePage = new URL(res.url).hostname;
    const title = raw === null ? null : applyTitleRules(raw, hostServingThePage, rules);
    return json({ ok: true, url: res.url, title } satisfies LinkTitleResponse);
  } catch (e) {
    return fail("io", fetchFailureMessage(e));
  }
};
