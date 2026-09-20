import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";
import { formatMarkdown, versionsNewestFirst } from "./format.ts";
import { CONTENT_ROOT } from "./paths.ts";

const fakeDirectory = await fs.mkdtemp(path.join(os.tmpdir(), "blog-format-test-"));
const invocationLog = path.join(fakeDirectory, "invocations.log");
const fakeHongdown = path.join(fakeDirectory, "hongdown");
await fs.writeFile(
  fakeHongdown,
  `#!/bin/sh
echo "$*" >> '${invocationLog}'
case "$2" in
  *crash*) echo "cannot parse" >&2; exit 2 ;;
  *notice*) printf '  line 3: heading too long  \\n' >&2 ;;
esac
`,
  { mode: 0o755 },
);
process.env["HONGDOWN_BIN"] = fakeHongdown;
after(() => fs.rm(fakeDirectory, { recursive: true, force: true }));

const cleanFile = path.join(fakeDirectory, "clean.md");
const noticeFile = path.join(fakeDirectory, "notice.md");
const crashFile = path.join(CONTENT_ROOT, "2099/01/crash.ko-Hang.md");

async function takeInvocations(): Promise<string[]> {
  const logged = await fs.readFile(invocationLog, "utf-8").catch(() => "");
  await fs.rm(invocationLog, { force: true });
  return logged.split("\n").filter((line) => line !== "");
}

test("the formatter named by HONGDOWN_BIN is checked and then run in write mode", async () => {
  assert.deepEqual(await formatMarkdown(cleanFile), { formatted: true });
  assert.deepEqual(await takeInvocations(), ["--version", `-w ${cleanFile}`]);
});

test("a formatter that already worked is not checked again", async () => {
  await formatMarkdown(cleanFile);
  await takeInvocations();
  await formatMarkdown(cleanFile);
  assert.deepEqual(await takeInvocations(), [`-w ${cleanFile}`]);
});

test("stderr of a successful run comes back trimmed as notices", async () => {
  assert.deepEqual(await formatMarkdown(noticeFile), {
    formatted: true,
    notices: "line 3: heading too long",
  });
});

test("a crash comes back as a warning with repository paths made relative", async () => {
  assert.deepEqual(await formatMarkdown(crashFile), {
    formatted: false,
    warning: `Command failed: ${fakeHongdown} -w 2099/01/crash.ko-Hang.md\ncannot parse\n`,
  });
});

test("after a crash the formatter is checked again before the next run", async () => {
  await formatMarkdown(crashFile);
  await takeInvocations();
  await formatMarkdown(cleanFile);
  assert.deepEqual(await takeInvocations(), ["--version", `-w ${cleanFile}`]);
});

test("mise install directories are ordered by version number, not as text", () => {
  assert.deepEqual(
    versionsNewestFirst(["0.9.3", "0.10.0", "0.3.8", "0.3.11", "0.5.3", "0.5", "latest"]),
    ["0.10.0", "0.9.3", "0.5.3", "0.5", "0.3.11", "0.3.8", "latest"],
  );
});
