import type { AdminConfig } from "../config.ts";
import type { BookInfo, PostType } from "../../lib/posts.ts";

export type { BookInfo, PostType };

export type Lang = "ko-Hang" | "ko-Kore" | "en";

/**
 * Front matter in the shape the editor form edits.  `published` stays a raw
 * string: parsing it through YAML and back would requote the timestamp, and
 * hongdown does not normalise front matter, so that requoting would be
 * permanent.
 */
export interface FrontMatterForm {
  published: string;
  description?: string;
  draft?: boolean;
  dark?: boolean;
  type?: PostType;
  book?: BookInfo;
  /** Create-only: emit empty `title:`/`author:` lines like new-reading.sh. */
  bookScaffold?: boolean;
}

export interface PostLocation {
  /** URL path without extension, e.g. "2026/02/career". */
  postPath: string;
  year: string;
  month: string;
  slug: string;
}

export interface SourceLocation extends PostLocation {
  /** Repo-relative, e.g. "2026/02/career.ko-Hang.md". */
  file: string;
  lang: Lang;
}

export interface PostSourceSummary extends SourceLocation {
  /** First heading, via markdown-it-title on the raw body. */
  title: string;
  /** Verbatim front matter text, not a re-serialised timestamp. */
  published: string;
  publishedMs: number;
  description?: string;
  draft: boolean;
  dark: boolean;
  type?: PostType;
  book?: BookInfo;
  /** ["ko-Hang"] for a ko-Kore source, which seonbi derives at build time. */
  derivedLangs: Lang[];
  bytes: number;
  mtimeMs: number;
  /** Set instead of throwing, so one bad file cannot blank the whole list. */
  parseError?: string;
}

export interface PostGroup extends PostLocation {
  sources: PostSourceSummary[];
  /** Languages this post has no source file for; drives "add translation". */
  missingLangs: Lang[];
  /** Sibling directory named after the slug, shared by every language. */
  assetDir: string | null;
  assetCount: number;
}

export interface PostAssetInfo {
  file: string;
  bytes: number;
}

export interface RenderedView {
  lang: string;
  title: string;
  /** A complete HTML document from the real PostView render, for an iframe. */
  document: string;
}

export type ApiErrorCode =
  | "bad-request"
  | "not-found"
  | "invalid"
  | "stale"
  | "exists"
  | "io"
  | "unsupported-type"
  | "too-large"
  | "bad-name"
  | "forbidden";

export type ApiFailure = { ok: false; error: ApiErrorCode; message: string };

export type PostsResponse =
  | { ok: true; groups: PostGroup[]; scannedAt: number }
  | ApiFailure;

export type SourceResponse =
  | (SourceLocation & {
      ok: true;
      /** Original front matter block including both `---` fences. */
      fenceRaw: string;
      body: string;
      frontmatter: FrontMatterForm;
      /** Optimistic-concurrency token. */
      mtimeMs: number;
      assets: PostAssetInfo[];
    })
  | ApiFailure;

export type PreviewResponse =
  | { ok: true; views: RenderedView[]; ms: number }
  | ApiFailure;

export interface PreviewRequest {
  /** Repo-relative, e.g. "2026/02/career.ko-Hang.md"; the preview needs the
   * post's URL path to render its header, language nav and asset base. */
  file: string;
  frontmatter: FrontMatterForm;
  body: string;
  lang: Lang;
}

export type SaveResponse =
  | {
      ok: true;
      file: string;
      fenceRaw: string;
      body: string;
      mtimeMs: number;
      formatted: boolean;
      formatterWarning?: string;
      formatterNotices?: string;
    }
  | (ApiFailure & { currentMtimeMs?: number });

export type LinkTitleResponse =
  | {
      ok: true;
      /** Final URL after redirects. */
      url: string;
      /** Null when the document has no usable title. */
      title: string | null;
    }
  | ApiFailure;

export type ConfigResponse =
  | {
      ok: true;
      imageNamePattern: string;
      imageTypes: Record<string, string>;
      maxImageBytes: number;
      formatOnSave: boolean;
      editorEngine: AdminConfig["editorEngine"];
      langs: Lang[];
    }
  | ApiFailure;
