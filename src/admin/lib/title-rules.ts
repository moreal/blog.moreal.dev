import { promises as fs } from "node:fs";
import path from "node:path";
import { parse } from "smol-toml";
import { ADMIN_CONFIG } from "../config.ts";
import { CONTENT_ROOT } from "./paths.ts";

/**
 * Per-site cleanup rules for fetched link titles -- "Foo - RosettaLens 번역"
 * becoming just "Foo".  The rules live in a TOML file (ADMIN_CONFIG.
 * linkTitleRulesFile) so they are data under version control, and the file is
 * re-read on every request so edits apply immediately.
 *
 * A broken rules file throws TitleRuleError instead of being skipped: the
 * author just edited it and a silently-ignored typo would look like the rule
 * simply "not working".
 */

export class TitleRuleError extends Error {}

export interface TitleRule {
  /** Lowercased host patterns: exact, "*.host" (subdomains + bare), or "*". */
  hosts: string[];
  stripPrefix: string[];
  stripSuffix: string[];
  replace: { re: RegExp; to: string }[];
}

const KNOWN_KEYS = ["host", "strip-prefix", "strip-suffix", "replace"];

export async function loadTitleRules(): Promise<TitleRule[]> {
  const rel = ADMIN_CONFIG.linkTitleRulesFile;
  let text: string;
  try {
    text = await fs.readFile(path.join(CONTENT_ROOT, ...rel.split("/")), "utf-8");
  } catch {
    return []; // No file, no rules.
  }
  return parseTitleRules(text, path.basename(rel));
}

export function parseTitleRules(text: string, file: string): TitleRule[] {
  let doc: unknown;
  try {
    doc = parse(text);
  } catch (e) {
    throw new TitleRuleError(
      `${file}: ${e instanceof Error ? e.message : String(e)}`,
    );
  }
  const raw = (doc as Record<string, unknown>)["rule"];
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) {
    throw new TitleRuleError(`${file}: rule은 [[rule]] 배열이어야 합니다`);
  }
  return raw.map((entry, i) => {
    const where = `${file} [[rule]] ${i + 1}`;
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new TitleRuleError(`${where}: 테이블이 아닙니다`);
    }
    const t = entry as Record<string, unknown>;
    for (const key of Object.keys(t)) {
      if (!KNOWN_KEYS.includes(key)) {
        throw new TitleRuleError(
          `${where}: 모르는 키 "${key}" (가능: ${KNOWN_KEYS.join(", ")})`,
        );
      }
    }
    if (t["host"] === undefined) {
      throw new TitleRuleError(`${where}: host가 없습니다`);
    }
    return {
      hosts: asStrings(t["host"], `${where} host`).map((h) => h.toLowerCase()),
      stripPrefix:
        t["strip-prefix"] === undefined
          ? []
          : asStrings(t["strip-prefix"], `${where} strip-prefix`),
      stripSuffix:
        t["strip-suffix"] === undefined
          ? []
          : asStrings(t["strip-suffix"], `${where} strip-suffix`),
      replace:
        t["replace"] === undefined ? [] : asReplaces(t["replace"], where),
    };
  });
}

function asStrings(v: unknown, where: string): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
    return v as string[];
  }
  throw new TitleRuleError(`${where}: 문자열이나 문자열 배열이어야 합니다`);
}

function asReplaces(v: unknown, where: string): { re: RegExp; to: string }[] {
  if (!Array.isArray(v)) {
    throw new TitleRuleError(`${where} replace: 배열이어야 합니다`);
  }
  if (v.length === 0) return [];
  // A single [pattern, to(, flags)] or an array of them.
  const list = Array.isArray(v[0]) ? v : [v];
  return list.map((pair, j) => {
    const at = `${where} replace ${j + 1}`;
    if (
      !Array.isArray(pair) ||
      pair.length < 2 ||
      pair.length > 3 ||
      !pair.every((x) => typeof x === "string")
    ) {
      throw new TitleRuleError(
        `${at}: [정규식, 치환] 또는 [정규식, 치환, 플래그] 여야 합니다`,
      );
    }
    const [pattern, to, flags] = pair as [string, string, string?];
    try {
      return { re: new RegExp(pattern, flags ?? ""), to };
    } catch (e) {
      throw new TitleRuleError(
        `${at}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  });
}

export function hostMatches(pattern: string, hostname: string): boolean {
  if (pattern === "*") return true;
  if (pattern.startsWith("*.")) {
    const base = pattern.slice(2);
    return hostname === base || hostname.endsWith("." + base);
  }
  return hostname === pattern;
}

/** Every matching rule applies, in file order: strip-prefix → strip-suffix → replace. */
export function applyTitleRules(
  title: string,
  hostname: string,
  rules: readonly TitleRule[],
): string {
  const host = hostname.toLowerCase();
  let out = title;
  for (const rule of rules) {
    if (!rule.hosts.some((p) => hostMatches(p, host))) continue;
    for (const p of rule.stripPrefix) {
      if (out.startsWith(p)) out = out.slice(p.length);
    }
    for (const s of rule.stripSuffix) {
      if (out.endsWith(s)) out = out.slice(0, out.length - s.length);
    }
    for (const { re, to } of rule.replace) out = out.replace(re, to);
  }
  out = out.replace(/\s+/g, " ").trim();
  // Rules that eat the whole title were surely not meant to.
  return out === "" ? title : out;
}
