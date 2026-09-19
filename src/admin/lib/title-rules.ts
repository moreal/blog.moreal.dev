import path from "node:path";
import { parse } from "smol-toml";
import { ADMIN_CONFIG } from "../config.ts";
import { errorMessage } from "../shared/errors.ts";
import { readTextOrNull } from "./files.ts";
import { CONTENT_ROOT, contentPath } from "./paths.ts";

export class TitleRuleError extends Error {}

interface TitleReplacement {
  pattern: RegExp;
  replacement: string;
}

export interface TitleRule {
  lowercaseHostPatterns: string[];
  stripPrefixes: string[];
  stripSuffixes: string[];
  replacements: TitleReplacement[];
}

const RULE_KEYS = ["host", "strip-prefix", "strip-suffix", "replace"];

const ANY_HOST = "*";

const DOMAIN_AND_SUBDOMAINS = "*.";

export async function loadTitleRules(root: string = CONTENT_ROOT): Promise<TitleRule[]> {
  const rulesFile = ADMIN_CONFIG.linkTitleRulesFile;
  const rulesToml = await readTextOrNull(contentPath(rulesFile, root));
  if (rulesToml === null) return [];
  return parseTitleRules(rulesToml, path.basename(rulesFile));
}

export function parseTitleRules(rulesToml: string, fileName: string): TitleRule[] {
  const ruleEntries = ruleEntriesOf(parseToml(rulesToml, fileName), fileName);
  return ruleEntries.map((entry, index) => parseRule(entry, `${fileName} [[rule]] ${index + 1}`));
}

function parseToml(rulesToml: string, fileName: string): Record<string, unknown> {
  try {
    return parse(rulesToml);
  } catch (error) {
    throw ruleErrorCausedBy(error, fileName);
  }
}

function ruleEntriesOf(document: Record<string, unknown>, fileName: string): unknown[] {
  const ruleEntries = document["rule"];
  if (ruleEntries === undefined) return [];
  if (!Array.isArray(ruleEntries)) {
    throw new TitleRuleError(`${fileName}: rule은 [[rule]] 배열이어야 합니다`);
  }
  return ruleEntries;
}

function parseRule(entry: unknown, location: string): TitleRule {
  const table = asTable(entry, location);
  assertOnlyRuleKeys(table, location);
  if (table["host"] === undefined) {
    throw new TitleRuleError(`${location}: host가 없습니다`);
  }
  return {
    lowercaseHostPatterns: asStrings(table["host"], `${location} host`).map((host) => host.toLowerCase()),
    stripPrefixes: asOptionalStrings(table["strip-prefix"], `${location} strip-prefix`),
    stripSuffixes: asOptionalStrings(table["strip-suffix"], `${location} strip-suffix`),
    replacements: asOptionalReplacements(table["replace"], `${location} replace`),
  };
}

function asTable(entry: unknown, location: string): Record<string, unknown> {
  if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
    throw new TitleRuleError(`${location}: 테이블이 아닙니다`);
  }
  return entry as Record<string, unknown>;
}

function assertOnlyRuleKeys(table: Record<string, unknown>, location: string): void {
  const unknownKey = Object.keys(table).find((key) => !RULE_KEYS.includes(key));
  if (unknownKey !== undefined) {
    throw new TitleRuleError(`${location}: 모르는 키 "${unknownKey}" (가능: ${RULE_KEYS.join(", ")})`);
  }
}

function asOptionalStrings(value: unknown, location: string): string[] {
  return value === undefined ? [] : asStrings(value, location);
}

function asStrings(value: unknown, location: string): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value) && value.every((item) => typeof item === "string")) {
    return value as string[];
  }
  throw new TitleRuleError(`${location}: 문자열이나 문자열 배열이어야 합니다`);
}

function asOptionalReplacements(value: unknown, location: string): TitleReplacement[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TitleRuleError(`${location}: 배열이어야 합니다`);
  }
  return replacementEntriesOf(value).map((entry, index) => asReplacement(entry, `${location} ${index + 1}`));
}

function replacementEntriesOf(replace: unknown[]): unknown[] {
  if (replace.length === 0) return [];
  const isSingleReplacement = !Array.isArray(replace[0]);
  return isSingleReplacement ? [replace] : replace;
}

function asReplacement(entry: unknown, location: string): TitleReplacement {
  if (!isReplacementTuple(entry)) {
    throw new TitleRuleError(`${location}: [정규식, 치환] 또는 [정규식, 치환, 플래그] 여야 합니다`);
  }
  const [source, replacement, flags] = entry;
  try {
    return { pattern: new RegExp(source, flags ?? ""), replacement };
  } catch (error) {
    throw ruleErrorCausedBy(error, location);
  }
}

function isReplacementTuple(entry: unknown): entry is [string, string, string?] {
  return (
    Array.isArray(entry) &&
    entry.length >= 2 &&
    entry.length <= 3 &&
    entry.every((part) => typeof part === "string")
  );
}

function ruleErrorCausedBy(error: unknown, location: string): TitleRuleError {
  return new TitleRuleError(`${location}: ${errorMessage(error)}`);
}

export function applyTitleRules(title: string, hostname: string, rules: readonly TitleRule[]): string {
  const lowercaseHost = hostname.toLowerCase();
  const cleaned = rules.filter((rule) => ruleAppliesTo(rule, lowercaseHost)).reduce(applyRule, title);
  const collapsed = cleaned.replace(/\s+/g, " ").trim();
  return collapsed === "" ? title : collapsed;
}

function ruleAppliesTo(rule: TitleRule, lowercaseHost: string): boolean {
  return rule.lowercaseHostPatterns.some((pattern) => hostMatches(pattern, lowercaseHost));
}

function hostMatches(pattern: string, host: string): boolean {
  if (pattern === ANY_HOST) return true;
  if (pattern.startsWith(DOMAIN_AND_SUBDOMAINS)) {
    const domain = pattern.slice(DOMAIN_AND_SUBDOMAINS.length);
    return host === domain || host.endsWith("." + domain);
  }
  return host === pattern;
}

function applyRule(title: string, rule: TitleRule): string {
  let cleaned = title;
  for (const prefix of rule.stripPrefixes) cleaned = withoutPrefix(cleaned, prefix);
  for (const suffix of rule.stripSuffixes) cleaned = withoutSuffix(cleaned, suffix);
  for (const { pattern, replacement } of rule.replacements) cleaned = cleaned.replace(pattern, replacement);
  return cleaned;
}

function withoutPrefix(text: string, prefix: string): string {
  return text.startsWith(prefix) ? text.slice(prefix.length) : text;
}

function withoutSuffix(text: string, suffix: string): string {
  return text.endsWith(suffix) ? text.slice(0, text.length - suffix.length) : text;
}
