import { execFile } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { errorMessage } from "../shared/errors.ts";
import { CONTENT_ROOT } from "./paths.ts";

const run = promisify(execFile);

export interface FormatResult {
  formatted: boolean;
  /** hongdown writes lint notices to stderr while still exiting 0. */
  notices?: string;
  warning?: string;
}

const LOOKUP_TIMEOUT_MS = 5000;
const FORMAT_TIMEOUT_MS = 10_000;

/** mise puts a shim on PATH, and astro dev inherits the activated shell's PATH. */
const HONGDOWN_ON_PATH = "hongdown";

const MISE_INSTALLS = path.join(
  os.homedir(),
  ".local/share/mise/installs/github-dahlia-hongdown",
);

let cachedHongdown: string | null | undefined;

function hongdownFromEnvironment(): string[] {
  const configured = process.env["HONGDOWN_BIN"];
  return configured === undefined || configured === "" ? [] : [configured];
}

async function hongdownFromMiseWhich(): Promise<string[]> {
  try {
    const { stdout } = await run("mise", ["which", "hongdown"], {
      timeout: LOOKUP_TIMEOUT_MS,
    });
    const bin = stdout.trim();
    return bin === "" ? [] : [bin];
  } catch {
    return [];
  }
}

const VERSION_FIELDS = 3;
const BELOW_ANY_VERSION = -1;

function versionNumbers(name: string): number[] {
  const fields = name.split(".");
  return Array.from({ length: VERSION_FIELDS }, (_, index) => {
    const field = Number.parseInt(fields[index] ?? "", 10);
    return Number.isNaN(field) ? BELOW_ANY_VERSION : field;
  });
}

function newerFirst(a: string, b: string): number {
  const earlier = versionNumbers(a);
  return (
    versionNumbers(b)
      .map((field, index) => field - earlier[index]!)
      .find((difference) => difference !== 0) ?? 0
  );
}

/** "0.10.2" is newer than "0.9.3", and a name that is no version at all, such
 * as mise's "latest" link, comes last. */
export function versionsNewestFirst(names: string[]): string[] {
  return [...names].sort(newerFirst);
}

async function hongdownsInMiseInstalls(): Promise<string[]> {
  try {
    const versions = versionsNewestFirst(await fs.readdir(MISE_INSTALLS));
    return versions.map((version) =>
      path.join(MISE_INSTALLS, version, "hongdown"),
    );
  } catch {
    return [];
  }
}

async function hongdownCandidates(): Promise<string[]> {
  return [
    ...hongdownFromEnvironment(),
    HONGDOWN_ON_PATH,
    ...(await hongdownFromMiseWhich()),
    ...(await hongdownsInMiseInstalls()),
  ];
}

async function answersVersion(bin: string): Promise<boolean> {
  try {
    await run(bin, ["--version"], { timeout: LOOKUP_TIMEOUT_MS });
    return true;
  } catch {
    return false;
  }
}

async function firstRunnable(candidates: string[]): Promise<string | null> {
  for (const candidate of candidates) {
    if (await answersVersion(candidate)) return candidate;
  }
  return null;
}

async function findHongdown(): Promise<string | null> {
  if (cachedHongdown !== undefined) return cachedHongdown;
  cachedHongdown = await firstRunnable(await hongdownCandidates());
  return cachedHongdown;
}

function forgetCachedHongdown(): void {
  cachedHongdown = undefined;
}

function hongdownNotFound(): FormatResult {
  return {
    formatted: false,
    warning:
      "hongdown을 찾지 못했습니다. HONGDOWN_BIN 환경변수로 경로를 지정할 수 있습니다.",
  };
}

function formattedWithNotices(stderr: string): FormatResult {
  const notices = stderr.trim();
  return notices === "" ? { formatted: true } : { formatted: true, notices };
}

function withoutContentRoot(message: string): string {
  return message.replaceAll(CONTENT_ROOT + "/", "");
}

function formatterCrashed(error: unknown): FormatResult {
  return { formatted: false, warning: withoutContentRoot(errorMessage(error)) };
}

/**
 * Format in place.  `-w` makes hongdown discover .hongdown.toml by walking up
 * from the file, which is what keeps the CMS's output identical to what Zed's
 * format-on-save produces.
 *
 * Never throws: the caller has already written the file, and losing the text
 * would be a far worse failure than an unformatted file.
 */
export async function formatMarkdown(file: string): Promise<FormatResult> {
  const hongdown = await findHongdown();
  if (hongdown === null) return hongdownNotFound();
  try {
    const { stderr } = await run(hongdown, ["-w", file], {
      cwd: CONTENT_ROOT,
      timeout: FORMAT_TIMEOUT_MS,
    });
    return formattedWithNotices(stderr);
  } catch (error) {
    forgetCachedHongdown();
    return formatterCrashed(error);
  }
}
