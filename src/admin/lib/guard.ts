import { PathError } from "./paths.ts";
import type { ApiError, ApiFailure } from "./types.ts";

const HTTP_STATUS_BY_ERROR: Record<ApiError, number> = {
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

type RequestContentType = "application/json" | "multipart/form-data";

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
  return json({ ok: false, error, message } satisfies ApiFailure, HTTP_STATUS_BY_ERROR[error]);
}

export function errorMessageForClient(error: unknown): string {
  if (error instanceof PathError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  return withoutRepositoryPath(message);
}

function withoutRepositoryPath(message: string): string {
  const repositoryPath = process.cwd();
  return message.replaceAll(repositoryPath + "/", "").replaceAll(repositoryPath, "");
}

export function checkRequest(
  request: Request,
  url: URL,
  expected: { contentType?: RequestContentType } = {},
): Response | null {
  if (isCrossOrigin(request, url)) {
    return fail("forbidden", "cross-origin request rejected");
  }
  if (expected.contentType !== undefined && !hasContentType(request, expected.contentType)) {
    return fail("bad-request", `expected ${expected.contentType}`);
  }
  return null;
}

function isCrossOrigin(request: Request, url: URL): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin !== url.origin;
}

function hasContentType(request: Request, contentType: RequestContentType): boolean {
  return (request.headers.get("content-type") ?? "").includes(contentType);
}
