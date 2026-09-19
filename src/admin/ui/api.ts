import type {
  ApiFailure,
  ConfigResponse,
  LinkTitleResponse,
  PostGroup,
  PostsResponse,
  PreviewRequest,
  PreviewResponse,
  RenderedView,
  SearchResponse,
  SourceResponse,
} from "../lib/types.ts";

export class ApiError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
  }
}

type Ok<T> = Extract<T, { ok: true }>;

export type LoadedSource = Ok<SourceResponse>;

async function call<T extends { ok: boolean }>(
  path: string,
  init?: RequestInit,
): Promise<Ok<T>> {
  const res = await fetch(`/admin/api/${path}`, init);
  let data: T | ApiFailure;
  try {
    data = (await res.json()) as T | ApiFailure;
  } catch {
    throw new ApiError("io", `${path}: ${res.status} ${res.statusText}`);
  }
  if (!data.ok) {
    const f = data as ApiFailure;
    throw new ApiError(f.error, f.message);
  }
  return data as Ok<T>;
}

const asJson = (body: unknown): RequestInit => ({
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify(body),
});

export const api = {
  posts: (): Promise<{ groups: PostGroup[]; scannedAt: number }> =>
    call<PostsResponse>("posts"),

  config: () => call<ConfigResponse>("config"),

  source: (file: string) =>
    call<SourceResponse>(`source?file=${encodeURIComponent(file)}`),

  preview: (body: PreviewRequest): Promise<{ views: RenderedView[]; ms: number }> =>
    call<PreviewResponse>("preview", asJson(body)),

  linkTitle: (url: string) =>
    call<LinkTitleResponse>(`link-title?url=${encodeURIComponent(url)}`),

  search: (q: string) =>
    call<SearchResponse>(`search?q=${encodeURIComponent(q)}`),
};
