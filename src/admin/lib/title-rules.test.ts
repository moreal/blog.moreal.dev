import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { type TestContext } from "node:test";
import { ADMIN_CONFIG } from "../config.ts";
import { TitleRuleError, applyTitleRules, loadTitleRules, parseTitleRules } from "./title-rules.ts";

const RULES_FILE_NAME = "link-title.toml";

function cleanedTitle(title: string, hostname: string, rulesToml: string): string {
  return applyTitleRules(title, hostname, parseTitleRules(rulesToml, RULES_FILE_NAME));
}

function assertRulesRejected(rulesToml: string, expectedMessage: string | RegExp): void {
  assert.throws(
    () => parseTitleRules(rulesToml, RULES_FILE_NAME),
    (error: unknown) => {
      assert.ok(error instanceof TitleRuleError);
      if (typeof expectedMessage === "string") assert.equal(error.message, expectedMessage);
      else assert.match(error.message, expectedMessage);
      return true;
    },
  );
}

async function contentRootWithRules(t: TestContext, rulesToml: string | null): Promise<string> {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "blog-title-rules-test-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  if (rulesToml !== null) await writeRules(root, rulesToml);
  return root;
}

async function writeRules(root: string, rulesToml: string): Promise<void> {
  const rulesPath = path.join(root, ADMIN_CONFIG.linkTitleRulesFile);
  await fs.mkdir(path.dirname(rulesPath), { recursive: true });
  await fs.writeFile(rulesPath, rulesToml);
}

test("a rules file without [[rule]] tables has no rules, and keys outside them are ignored", () => {
  assert.deepEqual(parseTitleRules("", RULES_FILE_NAME), []);
  assert.deepEqual(parseTitleRules("# 주석만\n", RULES_FILE_NAME), []);
  assert.deepEqual(parseTitleRules("other = 1\n", RULES_FILE_NAME), []);
});

test("with no matching rule a title is only whitespace-collapsed and trimmed", () => {
  assert.equal(applyTitleRules("  Foo \n  Bar ", "example.com", []), "Foo Bar");
  assert.equal(
    cleanedTitle("Foo - Ex", "example.org", '[[rule]]\nhost = "example.com"\nstrip-suffix = " - Ex"\n'),
    "Foo - Ex",
  );
});

test("an exact host pattern matches only that host", () => {
  const rules = '[[rule]]\nhost = "example.com"\nstrip-suffix = " - Ex"\n';
  assert.equal(cleanedTitle("Foo - Ex", "example.com", rules), "Foo");
  assert.equal(cleanedTitle("Foo - Ex", "www.example.com", rules), "Foo - Ex");
});

test("a *.domain host pattern matches the domain itself and every subdomain, not a lookalike", () => {
  const rules = '[[rule]]\nhost = "*.wikipedia.org"\nstrip-suffix = " - Wikipedia"\n';
  assert.equal(cleanedTitle("Pandoc - Wikipedia", "wikipedia.org", rules), "Pandoc");
  assert.equal(cleanedTitle("Pandoc - Wikipedia", "en.wikipedia.org", rules), "Pandoc");
  assert.equal(cleanedTitle("Pandoc - Wikipedia", "en.m.wikipedia.org", rules), "Pandoc");
  assert.equal(cleanedTitle("Pandoc - Wikipedia", "notwikipedia.org", rules), "Pandoc - Wikipedia");
});

test("the * host pattern matches every host", () => {
  assert.equal(cleanedTitle("Foo!", "anything.example", '[[rule]]\nhost = "*"\nstrip-suffix = "!"\n'), "Foo");
});

test("host patterns and hostnames are compared case-insensitively", () => {
  const rules = '[[rule]]\nhost = "Example.COM"\nstrip-suffix = " - Ex"\n';
  assert.equal(cleanedTitle("Foo - Ex", "EXAMPLE.com", rules), "Foo");
});

test("host, strip-prefix and strip-suffix each take a string or a list of strings", () => {
  const rules =
    '[[rule]]\nhost = ["a.com", "b.com"]\nstrip-prefix = ["A: ", "B: "]\nstrip-suffix = " | Site"\n';
  assert.equal(cleanedTitle("A: B: Foo | Site", "a.com", rules), "Foo");
  assert.equal(cleanedTitle("A: B: Foo | Site", "b.com", rules), "Foo");
  assert.equal(cleanedTitle("A: B: Foo | Site", "c.com", rules), "A: B: Foo | Site");
});

test("strip entries apply in turn, each only when the title still has that affix", () => {
  const rules = '[[rule]]\nhost = "*"\nstrip-prefix = ["A: ", "B: "]\n';
  assert.equal(cleanedTitle("B: A: Foo", "a.com", rules), "A: Foo");
  assert.equal(cleanedTitle("Foo", "a.com", rules), "Foo");
});

test("within a rule strip-prefix runs before strip-suffix", () => {
  const rules = '[[rule]]\nhost = "*"\nstrip-prefix = "ab"\nstrip-suffix = "bc"\n';
  assert.equal(cleanedTitle("abc", "a.com", rules), "c");
});

test("within a rule replace runs after both strips", () => {
  const rules = "[[rule]]\nhost = \"*\"\nstrip-prefix = \"[\"\nstrip-suffix = \"]\"\nreplace = ['^\\[(.*)\\]$', '<$1>']\n";
  assert.equal(cleanedTitle("[Foo]", "a.com", rules), "Foo");
});

test("every matching rule applies, in file order", () => {
  const rules =
    '[[rule]]\nhost = "*"\nreplace = ["a", "b"]\n\n' +
    '[[rule]]\nhost = "a.com"\nreplace = ["b", "c"]\n\n' +
    '[[rule]]\nhost = "other.com"\nreplace = ["c", "d"]\n';
  assert.equal(cleanedTitle("a", "a.com", rules), "c");
});

test("replace takes one [pattern, replacement] pair or a list of them, with optional flags", () => {
  assert.equal(cleanedTitle("foo", "a.com", '[[rule]]\nhost = "*"\nreplace = ["o", "0"]\n'), "f0o");
  assert.equal(cleanedTitle("fOo", "a.com", '[[rule]]\nhost = "*"\nreplace = ["o", "0", "gi"]\n'), "f00");
  assert.equal(
    cleanedTitle("foo", "a.com", '[[rule]]\nhost = "*"\nreplace = [["f", "F"], ["o", "0"]]\n'),
    "F0o",
  );
  assert.equal(cleanedTitle("foo", "a.com", '[[rule]]\nhost = "*"\nreplace = []\n'), "foo");
});

test("a replacement can keep a captured part, turning a site's tag into quotation marks", () => {
  const rules = "[[rule]]\nhost = \"rosettalens.com\"\nreplace = ['^(.*) - RosettaLens 번역$', '『$1』']\n";
  assert.equal(
    cleanedTitle("Pandoc - pandoc의 20년 - RosettaLens 번역", "rosettalens.com", rules),
    "『Pandoc - pandoc의 20년』",
  );
  assert.equal(cleanedTitle("Pandoc - pandoc의 20년", "rosettalens.com", rules), "Pandoc - pandoc의 20년");
});

test("whitespace left behind by the rules is collapsed and trimmed", () => {
  const rules = '[[rule]]\nhost = "*"\nstrip-prefix = "Foo"\n';
  assert.equal(cleanedTitle("Foo  Bar \t Baz ", "a.com", rules), "Bar Baz");
});

test("rules that would leave the title empty are taken as a mistake and the original title is kept", () => {
  assert.equal(cleanedTitle("Foo", "a.com", '[[rule]]\nhost = "*"\nstrip-prefix = "Foo"\n'), "Foo");
  assert.equal(cleanedTitle("Foo", "a.com", '[[rule]]\nhost = "*"\nreplace = [".*", " "]\n'), "Foo");
});

test("a TOML syntax error names the rules file", () => {
  assertRulesRejected('[[rule]]\nhost = \n', /^link-title\.toml: Invalid TOML document: /);
});

test("rule must be an array of tables", () => {
  assertRulesRejected('rule = "x"\n', "link-title.toml: rule은 [[rule]] 배열이어야 합니다");
});

test("each rule must be a table, and errors count rules from 1", () => {
  assertRulesRejected('rule = [{ host = "a.com" }, 1]\n', "link-title.toml [[rule]] 2: 테이블이 아닙니다");
  assertRulesRejected('rule = [["a.com"]]\n', "link-title.toml [[rule]] 1: 테이블이 아닙니다");
});

test("an unknown key is an error listing the keys a rule may have, so a typo does not silently do nothing", () => {
  assertRulesRejected(
    '[[rule]]\nhost = "a.com"\nstrip-prefixes = "x"\n',
    'link-title.toml [[rule]] 1: 모르는 키 "strip-prefixes" (가능: host, strip-prefix, strip-suffix, replace)',
  );
});

test("a misspelled host is reported as an unknown key before the missing host", () => {
  assertRulesRejected(
    '[[rule]]\nhots = "a.com"\n',
    'link-title.toml [[rule]] 1: 모르는 키 "hots" (가능: host, strip-prefix, strip-suffix, replace)',
  );
});

test("every rule needs a host", () => {
  assertRulesRejected(
    '[[rule]]\nhost = "a.com"\n\n[[rule]]\nstrip-prefix = "x"\n',
    "link-title.toml [[rule]] 2: host가 없습니다",
  );
});

test("host, strip-prefix and strip-suffix reject anything but a string or a list of strings", () => {
  assertRulesRejected('[[rule]]\nhost = 1\n', "link-title.toml [[rule]] 1 host: 문자열이나 문자열 배열이어야 합니다");
  assertRulesRejected(
    '[[rule]]\nhost = "a.com"\nstrip-prefix = true\n',
    "link-title.toml [[rule]] 1 strip-prefix: 문자열이나 문자열 배열이어야 합니다",
  );
  assertRulesRejected(
    '[[rule]]\nhost = "a.com"\nstrip-suffix = ["a", 1]\n',
    "link-title.toml [[rule]] 1 strip-suffix: 문자열이나 문자열 배열이어야 합니다",
  );
});

test("replace must be an array", () => {
  assertRulesRejected('[[rule]]\nhost = "a.com"\nreplace = "x"\n', "link-title.toml [[rule]] 1 replace: 배열이어야 합니다");
});

test("each replacement is [pattern, replacement] or [pattern, replacement, flags], counted from 1", () => {
  const shapeError = (index: number) =>
    `link-title.toml [[rule]] 1 replace ${index}: [정규식, 치환] 또는 [정규식, 치환, 플래그] 여야 합니다`;
  assertRulesRejected('[[rule]]\nhost = "a.com"\nreplace = ["x"]\n', shapeError(1));
  assertRulesRejected('[[rule]]\nhost = "a.com"\nreplace = [["a", "b"], ["c"]]\n', shapeError(2));
  assertRulesRejected('[[rule]]\nhost = "a.com"\nreplace = [["a", "b"], "c"]\n', shapeError(2));
  assertRulesRejected('[[rule]]\nhost = "a.com"\nreplace = [["a", "b", "g", "x"]]\n', shapeError(1));
  assertRulesRejected('[[rule]]\nhost = "a.com"\nreplace = [["a", 1]]\n', shapeError(1));
});

test("an invalid regular expression or flag names the replacement it is in", () => {
  assertRulesRejected(
    '[[rule]]\nhost = "a.com"\nreplace = ["(", ""]\n',
    /^link-title\.toml \[\[rule\]\] 1 replace 1: Invalid regular expression/,
  );
  assertRulesRejected(
    '[[rule]]\nhost = "a.com"\nreplace = [["a", "b"], ["a", "b", "z"]]\n',
    /^link-title\.toml \[\[rule\]\] 1 replace 2: Invalid flags/,
  );
});

test("a missing rules file means no rules", async (t) => {
  const root = await contentRootWithRules(t, null);
  assert.deepEqual(await loadTitleRules(root), []);
});

test("the rules file is read again on every call, so an edit applies without a restart", async (t) => {
  const root = await contentRootWithRules(t, '[[rule]]\nhost = "*"\nstrip-suffix = " - A"\n');
  assert.equal(applyTitleRules("Foo - A - B", "a.com", await loadTitleRules(root)), "Foo - A - B");

  await writeRules(root, '[[rule]]\nhost = "*"\nstrip-suffix = " - B"\n');
  assert.equal(applyTitleRules("Foo - A - B", "a.com", await loadTitleRules(root)), "Foo - A");
});

test("a broken rules file is an error naming the file rather than being skipped", async (t) => {
  const root = await contentRootWithRules(t, "rule = 1\n");
  await assert.rejects(loadTitleRules(root), (error: unknown) => {
    assert.ok(error instanceof TitleRuleError);
    assert.equal(
      error.message,
      `${path.basename(ADMIN_CONFIG.linkTitleRulesFile)}: rule은 [[rule]] 배열이어야 합니다`,
    );
    return true;
  });
});
