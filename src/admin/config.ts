/** The one file meant to be edited by hand to tune how the CMS behaves. */

export interface ImageNameContext {
  year: string;
  month: string;
  day: string;
  slug: string;
  lang: string;
  postPath: string;
  /** Name the clipboard reported; "image.png" for a macOS screenshot. */
  originalName: string | null;
  /** Derived from the MIME type, never from the client's filename. */
  ext: string;
  /** File names already sitting in the post's asset directory. */
  existing: string[];
}

export interface AdminConfig {
  /**
   * Fallback name for a pasted image, used when the clipboard carries no
   * meaningful file name.  Tokens: {slug} {year} {month} {day} {lang}
   * {index} {hhmmss} {original}
   */
  imageNamePattern: string;
  /** Full override; return a base name WITHOUT the extension. */
  suggestImageName?: (ctx: ImageNameContext) => string;
  /** Accepted upload types, mapped to the extension actually written. */
  imageTypes: Record<string, string>;
  maxImageBytes: number;
  /** Run hongdown after every save. */
  formatOnSave: boolean;
  /**
   * Which editor surface to use.  Both are kept permanently so that an OS or
   * browser update breaking IME handling is a one-word fix.
   */
  editorEngine: "codemirror" | "textarea";
  /**
   * Repo-relative TOML file with per-site cleanup rules for fetched link
   * titles; see the comment block in that file for the syntax.
   */
  linkTitleRulesFile: string;
}

export const ADMIN_CONFIG: AdminConfig = {
  imageNamePattern: "{slug}-{index}",
  imageTypes: {
    "image/png": ".png",
    "image/jpeg": ".jpg",
    "image/gif": ".gif",
    "image/webp": ".webp",
    "image/avif": ".avif",
    "image/svg+xml": ".svg",
  },
  maxImageBytes: 8 * 1024 * 1024,
  formatOnSave: true,
  editorEngine: "codemirror",
  linkTitleRulesFile: "src/admin/link-title.toml",
};
