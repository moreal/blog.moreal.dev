import { errorMessageForClient } from "./guard.ts";
import { decodeHtml, readResponsePrefix } from "./html-title.ts";

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 512 * 1024;

const BROWSER_LIKE_HEADERS = {
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
  accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.1",
  "accept-language": "ko,en;q=0.8",
};

export type PageUrl = { ok: true; url: URL } | { ok: false; message: string };

export function parsePageUrl(input: string): PageUrl {
  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    return { ok: false, message: "URL이 올바르지 않습니다" };
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return { ok: false, message: "http(s) URL만 지원합니다" };
  }
  return { ok: true, url };
}

export function fetchPage(url: URL): Promise<Response> {
  return fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: BROWSER_LIKE_HEADERS,
  });
}

export function discardBody(response: Response): void {
  void response.body?.cancel().catch(() => {});
}

export function isHtmlContentType(contentType: string): boolean {
  return /html|xhtml/i.test(contentType);
}

export async function readHtml(response: Response, contentType: string): Promise<string> {
  const bytes = await readResponsePrefix(response.body, MAX_HTML_BYTES);
  return decodeHtml(bytes, contentType);
}

function isTimeout(error: unknown): boolean {
  return (error as { name?: string } | null)?.name === "TimeoutError";
}

function causeSuffix(error: unknown): string {
  return error instanceof Error && error.cause instanceof Error ? `: ${error.cause.message}` : "";
}

export function fetchFailureMessage(error: unknown): string {
  if (isTimeout(error)) return `응답이 ${FETCH_TIMEOUT_MS / 1000}초 안에 오지 않았습니다`;
  return errorMessageForClient(error) + causeSuffix(error);
}
