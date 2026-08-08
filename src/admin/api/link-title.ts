import type { APIRoute } from "astro";
import { checkRequest, describe, fail, json } from "../lib/guard.ts";
import {
  TitleRuleError,
  applyTitleRules,
  loadTitleRules,
} from "../lib/title-rules.ts";
import type { LinkTitleResponse } from "../lib/types.ts";

export const prerender = false;

const TIMEOUT_MS = 8000;
const MAX_BYTES = 512 * 1024;
const MAX_TITLE = 300;

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
    const bytes = await readUpTo(res.body, MAX_BYTES);
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

/** The title lives in <head>; past MAX_BYTES it is not worth the wait. */
async function readUpTo(
  body: ReadableStream<Uint8Array> | null,
  max: number,
): Promise<Uint8Array> {
  if (body === null) return new Uint8Array(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (total < max) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  void reader.cancel().catch(() => {});
  const out = new Uint8Array(Math.min(total, max));
  let off = 0;
  for (const c of chunks) {
    if (off >= out.length) break;
    const slice = c.subarray(0, out.length - off);
    out.set(slice, off);
    off += slice.byteLength;
  }
  return out;
}

/**
 * Older Korean sites still serve EUC-KR, so the charset cannot be assumed.
 * Charset labels are ASCII, which survives a wrong UTF-8 decode -- so decode
 * once to find the label, then decode again with it if it differs.
 */
function decodeHtml(bytes: Uint8Array, contentType: string): string {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  const label = (
    /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ??
    /<meta[^>]+charset=["']?([\w-]+)/i.exec(utf8)?.[1] ??
    "utf-8"
  ).toLowerCase();
  if (label === "utf-8" || label === "utf8") return utf8;
  try {
    return new TextDecoder(label).decode(bytes);
  } catch {
    return utf8;
  }
}

/**
 * og:title first: it is the post's own name, where <title> tends to carry a
 * " — 사이트 이름" suffix that nobody wants in an alias.
 */
function extractTitle(html: string): string | null {
  const og = /<meta[^>]+(?:property|name)=["']og:title["'][^>]*>/i.exec(html)?.[0];
  if (og !== undefined) {
    const m = /content\s*=\s*(?:"([^"]*)"|'([^']*)')/i.exec(og);
    const value = m?.[1] ?? m?.[2];
    if (value !== undefined && value.trim() !== "") return clean(value);
  }
  const t = /<title[^>]*>([\s\S]*?)<\/title/i.exec(html)?.[1];
  if (t !== undefined && t.trim() !== "") return clean(t);
  return null;
}

function clean(raw: string): string {
  return decodeEntities(raw).replace(/\s+/g, " ").trim().slice(0, MAX_TITLE);
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  middot: "·",
  hellip: "…",
  mdash: "—",
  ndash: "–",
  laquo: "«",
  raquo: "»",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
};

function decodeEntities(s: string): string {
  return s.replace(
    /&(?:#x([0-9a-f]+)|#(\d+)|([a-z]+));/gi,
    (whole, hex: string | undefined, dec: string | undefined, name: string | undefined) => {
      try {
        if (hex !== undefined) return String.fromCodePoint(parseInt(hex, 16));
        if (dec !== undefined) return String.fromCodePoint(parseInt(dec, 10));
      } catch {
        return whole;
      }
      return NAMED_ENTITIES[name!.toLowerCase()] ?? whole;
    },
  );
}
