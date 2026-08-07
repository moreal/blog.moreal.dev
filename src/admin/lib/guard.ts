import { PathError } from "./paths.ts";
import type { ApiError, ApiFailure } from "./types.ts";

const STATUS: Record<ApiError, number> = {
  "bad-request": 400,
  "not-found": 404,
  "invalid": 422,
  "stale": 409,
  "exists": 409,
  "io": 500,
  "unsupported-type": 415,
  "too-large": 413,
  "bad-name": 400,
  "forbidden": 403,
};

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

export function fail(error: ApiError, message: string): Response {
  return json({ ok: false, error, message } satisfies ApiFailure, STATUS[error]);
}

/** Never leak an absolute filesystem path to the client. */
export function describe(e: unknown): string {
  if (e instanceof PathError) return e.message;
  const msg = e instanceof Error ? e.message : String(e);
  return msg.replaceAll(process.cwd() + "/", "").replaceAll(process.cwd(), "");
}

/**
 * Astro's dev server already blocks cross-origin subresource requests; this is
 * defence in depth.  Requiring a JSON content type also forces a CORS preflight
 * for any cross-origin caller, which the check above then rejects.
 */
export function checkRequest(
  request: Request,
  url: URL,
  opts: { json?: boolean } = {},
): Response | null {
  const origin = request.headers.get("origin");
  if (origin !== null && origin !== url.origin) {
    return fail("forbidden", "cross-origin request rejected");
  }
  if (opts.json === true) {
    const ct = request.headers.get("content-type") ?? "";
    if (!ct.includes("application/json")) {
      return fail("bad-request", "expected application/json");
    }
  }
  return null;
}
