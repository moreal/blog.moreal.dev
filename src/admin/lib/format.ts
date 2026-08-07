import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { CONTENT_ROOT } from "./paths.ts";

const run = promisify(execFile);

export interface FormatResult {
  formatted: boolean;
  /** hongdown writes lint notices to stderr while still exiting 0. */
  notices?: string;
  warning?: string;
}

let resolved: string | null | undefined;

const MISE_INSTALLS = path.join(
  os.homedir(),
  ".local/share/mise/installs/github-dahlia-hongdown",
);

async function candidates(): Promise<string[]> {
  const out: string[] = [];
  const env = process.env["HONGDOWN_BIN"];
  if (env !== undefined && env !== "") out.push(env);
  // `hongdown` on PATH works because mise puts a shim in ~/.local/share/mise/shims
  // and astro dev inherits the activated shell's PATH.
  out.push("hongdown");
  try {
    const { stdout } = await run("mise", ["which", "hongdown"], {
      timeout: 5000,
    });
    if (stdout.trim() !== "") out.push(stdout.trim());
  } catch {
    // mise absent or hongdown not installed through it; keep going.
  }
  try {
    const versions = (await fs.readdir(MISE_INSTALLS)).sort().reverse();
    for (const v of versions) out.push(path.join(MISE_INSTALLS, v, "hongdown"));
  } catch {
    // No mise install directory.
  }
  return out;
}

export async function resolveHongdown(): Promise<string | null> {
  if (resolved !== undefined) return resolved;
  for (const bin of await candidates()) {
    try {
      await run(bin, ["--version"], { timeout: 5000 });
      resolved = bin;
      return bin;
    } catch {
      continue;
    }
  }
  resolved = null;
  return null;
}

export async function triedPaths(): Promise<string[]> {
  return candidates();
}

/**
 * Format in place.  `-w` makes hongdown discover .hongdown.toml by walking up
 * from the file, which is what keeps the CMS's output identical to what Zed's
 * format-on-save produces.
 *
 * A missing formatter never blocks a save: losing the text would be a far worse
 * failure than an unformatted file, and `hongdown -w` can always be run later.
 */
export async function formatMarkdown(abs: string): Promise<FormatResult> {
  const bin = await resolveHongdown();
  if (bin === null) {
    return {
      formatted: false,
      warning:
        "hongdown을 찾지 못했습니다. HONGDOWN_BIN 환경변수로 경로를 지정할 수 있습니다.",
    };
  }
  try {
    const { stderr } = await run(bin, ["-w", abs], {
      cwd: CONTENT_ROOT,
      timeout: 10_000,
    });
    const notices = stderr.trim();
    return notices === "" ? { formatted: true } : { formatted: true, notices };
  } catch (e) {
    // A formatter crash means the file on disk may be untouched; the caller has
    // already written it, so report and move on.
    resolved = undefined;
    const msg = e instanceof Error ? e.message : String(e);
    return {
      formatted: false,
      warning: msg.replaceAll(CONTENT_ROOT + "/", ""),
    };
  }
}
